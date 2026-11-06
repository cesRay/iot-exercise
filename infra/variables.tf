variable "region" {
  description = "Región de AWS donde viven AWS IoT Core y Cognito."
  type        = string
  default     = "us-east-1"
}

variable "thing_name" {
  description = "Nombre del thing en AWS IoT Core. También es el ID de cliente MQTT del puente."
  type        = string
  default     = "foco-aula"
}

variable "topico_disponible" {
  description = "Tema MQTT donde el puente publica online/offline (Last Will)."
  type        = string
  default     = "aula/foco/disponible"
}

variable "correo_alertas" {
  description = "Correo que recibe la alerta de presupuesto."
  type        = string
}

variable "limite_presupuesto_usd" {
  description = "Gasto mensual en USD que dispara la alerta."
  type        = string
  default     = "1"
}
