// Tiempo máximo para que el foco confirme un cambio. Después, la página regresa al último estado confirmado.
export const ESPERA_CONFIRMACION_MS = 5000;
// Pausa sin cambios antes de enviar: evita un mensaje por cada píxel que se mueve un control.
export const PAUSA_ENVIO_MS = 150;

export const MENSAJE_SIN_CONFIRMACION =
  "El foco no confirmó el cambio. Revisa que la Raspberry Pi y el foco estén encendidos.";
