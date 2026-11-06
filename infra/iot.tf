data "aws_caller_identity" "actual" {}

data "aws_iot_endpoint" "datos" {
  endpoint_type = "iot:Data-ATS"
}

locals {
  arn_iot = "arn:aws:iot:${var.region}:${data.aws_caller_identity.actual.account_id}"
  sombra  = "$aws/things/${var.thing_name}/shadow"
}

resource "aws_iot_thing" "foco" {
  name = var.thing_name
}

# Certificado X.509 del puente. AWS genera la llave privada y Terraform la guarda en el estado local.
resource "aws_iot_certificate" "gateway" {
  active = true
}

resource "aws_iot_thing_principal_attachment" "gateway" {
  thing     = aws_iot_thing.foco.name
  principal = aws_iot_certificate.gateway.arn
}

# El puente solo puede conectarse como el thing y usar su sombra y el tema de disponibilidad.
resource "aws_iot_policy" "gateway" {
  name = "${var.thing_name}-gateway"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "iot:Connect"
        Resource = "${local.arn_iot}:client/${var.thing_name}"
      },
      {
        Effect = "Allow"
        Action = ["iot:Publish", "iot:Receive"]
        Resource = [
          "${local.arn_iot}:topic/${local.sombra}/*",
          "${local.arn_iot}:topic/${var.topico_disponible}",
        ]
      },
      {
        Effect   = "Allow"
        Action   = "iot:RetainPublish"
        Resource = "${local.arn_iot}:topic/${var.topico_disponible}"
      },
      {
        Effect   = "Allow"
        Action   = "iot:Subscribe"
        Resource = "${local.arn_iot}:topicfilter/${local.sombra}/*"
      },
    ]
  })
}

resource "aws_iot_policy_attachment" "gateway" {
  policy = aws_iot_policy.gateway.name
  target = aws_iot_certificate.gateway.arn
}

# Archivos que el puente necesita. Están en .gitignore: nunca se suben al repositorio.
data "http" "amazon_root_ca" {
  url = "https://www.amazontrust.com/repository/AmazonRootCA1.pem"
}

resource "local_file" "gateway_cert" {
  filename        = "${path.module}/../bridge/certs/certificate.pem.crt"
  content         = aws_iot_certificate.gateway.certificate_pem
  file_permission = "0644"
}

resource "local_sensitive_file" "gateway_key" {
  filename        = "${path.module}/../bridge/certs/private.pem.key"
  content         = aws_iot_certificate.gateway.private_key
  file_permission = "0600"
}

resource "local_file" "amazon_root_ca" {
  filename        = "${path.module}/../bridge/certs/AmazonRootCA1.pem"
  content         = data.http.amazon_root_ca.response_body
  file_permission = "0644"
}

resource "local_file" "bridge_config" {
  filename        = "${path.module}/../bridge/config.toml"
  file_permission = "0644"
  content         = <<-EOT
    # Generado por Terraform (infra/iot.tf). No lo edites a mano: cambia las variables y ejecuta terraform apply.
    endpoint = "${data.aws_iot_endpoint.datos.endpoint_address}"
    thing_name = "${var.thing_name}"
    topico_disponible = "${var.topico_disponible}"

    [certificados]
    cert = "certs/certificate.pem.crt"
    key = "certs/private.pem.key"
    ca = "certs/AmazonRootCA1.pem"

    [foco]
    # Vacío: el puente busca el foco en la red. Escribe la IP si la búsqueda falla.
    ip = ""
    broadcast = "172.20.10.15"
  EOT
}
