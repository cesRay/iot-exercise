// Mide el tiempo entre cada pulso (PINGREQ) y su respuesta (PINGRESP), en milisegundos.
export function medirPulso(cliente, alPulso) {
  let enviado = 0;
  cliente.on("packetsend", (paquete) => {
    if (paquete.cmd === "pingreq") enviado = performance.now();
  });
  cliente.on("packetreceive", (paquete) => {
    if (paquete.cmd === "pingresp") alPulso(Math.round(performance.now() - enviado));
  });
}
