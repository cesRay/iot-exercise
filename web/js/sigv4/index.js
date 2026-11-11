// URL prefirmada con AWS Signature Version 4 (SigV4) para conectar MQTT sobre WebSockets a AWS IoT Core.

import { ALGORITMO, RUTA, SERVICIO } from "./constants.js";
import { aHex, claveDeFirma, fechaAmz, hmac, sha256Hex } from "./utils.js";

export async function urlFirmada({ host, region, credenciales, ahora = new Date() }) {
  const { amzDate, dateStamp } = fechaAmz(ahora);
  const alcance = `${dateStamp}/${region}/${SERVICIO}/aws4_request`;
  const consulta = [
    `X-Amz-Algorithm=${ALGORITMO}`,
    `X-Amz-Credential=${encodeURIComponent(`${credenciales.accessKeyId}/${alcance}`)}`,
    `X-Amz-Date=${amzDate}`,
    "X-Amz-SignedHeaders=host",
  ].join("&");
  const solicitudCanonica = ["GET", RUTA, consulta, `host:${host}\n`, "host", await sha256Hex("")].join("\n");
  const textoAFirmar = [ALGORITMO, amzDate, alcance, await sha256Hex(solicitudCanonica)].join("\n");
  const clave = await claveDeFirma(credenciales.secretKey, dateStamp, region, SERVICIO);
  const firma = aHex(await hmac(clave, textoAFirmar));

  let url = `wss://${host}${RUTA}?${consulta}&X-Amz-Signature=${firma}`;
  // El token de sesión va después de la firma: AWS IoT Core no lo incluye en el cálculo.
  if (credenciales.sessionToken) url += `&X-Amz-Security-Token=${encodeURIComponent(credenciales.sessionToken)}`;
  return url;
}
