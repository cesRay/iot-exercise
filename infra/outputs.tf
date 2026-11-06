output "iot_endpoint" {
  description = "Endpoint de datos de AWS IoT Core."
  value       = data.aws_iot_endpoint.datos.endpoint_address
}

output "thing_name" {
  value = aws_iot_thing.foco.name
}

output "identity_pool_id" {
  value = aws_cognito_identity_pool.web.id
}
