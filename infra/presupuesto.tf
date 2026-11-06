# Alerta por correo si el gasto del mes supera el 80 % del límite.
resource "aws_budgets_budget" "mensual" {
  name         = "${var.thing_name}-mensual"
  budget_type  = "COST"
  limit_amount = var.limite_presupuesto_usd
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.correo_alertas]
  }
}
