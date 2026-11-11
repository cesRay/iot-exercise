// Mensajes del tema de disponibilidad. El puente publica EN_LINEA al conectarse.
// AWS IoT Core publica FUERA_DE_LINEA (Last Will) si el puente se desconecta sin avisar.
export const Disponibilidad = Object.freeze({
  EN_LINEA: "online",
  FUERA_DE_LINEA: "offline",
});
