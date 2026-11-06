# Grupo de identidades con acceso de invitado: la página obtiene credenciales temporales sin iniciar sesión.
resource "aws_cognito_identity_pool" "web" {
  identity_pool_name               = "foco_aula_web"
  allow_unauthenticated_identities = true
  allow_classic_flow               = false
}

resource "aws_iam_role" "web_invitado" {
  name = "${var.thing_name}-web-invitado"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Federated = "cognito-identity.amazonaws.com" }
        Action    = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.web.id
          }
          "ForAnyValue:StringLike" = {
            "cognito-identity.amazonaws.com:amr" = "unauthenticated"
          }
        }
      },
    ]
  })
}

locals {
  topicos_web = [
    "${local.sombra}/update/documents",
    "${local.sombra}/update/rejected",
    "${local.sombra}/get/accepted",
    "${local.sombra}/get/rejected",
    var.topico_disponible,
  ]
}

# El invitado solo puede pedir cambios a la sombra del foco y escuchar sus respuestas.
resource "aws_iam_role_policy" "web_invitado_iot" {
  name = "control-foco"
  role = aws_iam_role.web_invitado.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "iot:Connect"
        Resource = "${local.arn_iot}:client/web-*"
      },
      {
        Effect = "Allow"
        Action = "iot:Publish"
        Resource = [
          "${local.arn_iot}:topic/${local.sombra}/update",
          "${local.arn_iot}:topic/${local.sombra}/get",
        ]
      },
      {
        Effect   = "Allow"
        Action   = "iot:Subscribe"
        Resource = [for topico in local.topicos_web : "${local.arn_iot}:topicfilter/${topico}"]
      },
      {
        Effect   = "Allow"
        Action   = "iot:Receive"
        Resource = [for topico in local.topicos_web : "${local.arn_iot}:topic/${topico}"]
      },
    ]
  })
}

resource "aws_cognito_identity_pool_roles_attachment" "web" {
  identity_pool_id = aws_cognito_identity_pool.web.id
  roles = {
    unauthenticated = aws_iam_role.web_invitado.arn
  }
}

resource "local_file" "web_config" {
  filename        = "${path.module}/../web/config.js"
  file_permission = "0644"
  content         = <<-EOT
    // Generado por Terraform (infra/cognito.tf). No lo edites a mano.
    export const CONFIG = {
      region: "${var.region}",
      endpoint: "${data.aws_iot_endpoint.datos.endpoint_address}",
      identityPoolId: "${aws_cognito_identity_pool.web.id}",
      thingName: "${var.thing_name}",
      topicoDisponible: "${var.topico_disponible}",
    };
  EOT
}
