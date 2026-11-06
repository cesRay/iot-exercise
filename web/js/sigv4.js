const enc = new TextEncoder();
function aHex(buffer) { return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join(""); }
async function sha256Hex(texto) { return aHex(await crypto.subtle.digest("SHA-256", enc.encode(texto))); }
async function hmac(clave, texto) {
  const material = typeof clave === "string" ? enc.encode(clave) : clave;
  const k = await crypto.subtle.importKey("raw", material, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, enc.encode(texto));
}
export async function claveDeFirma(secreto, fecha, region, servicio) {
  let k = await hmac(`AWS4${secreto}`, fecha); k = await hmac(k, region); k = await hmac(k, servicio); return hmac(k, "aws4_request");
}
export function fechaAmz(fecha) { const amzDate = fecha.toISOString().replace(/[:-]|\.\d{3}/g, ""); return { amzDate, dateStamp: amzDate.slice(0, 8) }; }
export async function urlFirmada({ host, region, credenciales, ahora = new Date() }) {
  const servicio = "iotdevicegateway";
  const { amzDate, dateStamp } = fechaAmz(ahora);
  const alcance = `${dateStamp}/${region}/${servicio}/aws4_request`;
  const consulta = "X-Amz-Algorithm=AWS4-HMAC-SHA256" + `&X-Amz-Credential=${encodeURIComponent(`${credenciales.accessKeyId}/${alcance}`)}` + `&X-Amz-Date=${amzDate}` + "&X-Amz-SignedHeaders=host";
  const solicitudCanonica = ["GET", "/mqtt", consulta, `host:${host}\n`, "host", await sha256Hex("")].join("\n");
  const textoAFirmar = ["AWS4-HMAC-SHA256", amzDate, alcance, await sha256Hex(solicitudCanonica)].join("\n");
  const firma = aHex(await hmac(await claveDeFirma(credenciales.secretKey, dateStamp, region, servicio), textoAFirmar));
  let url = `wss://${host}/mqtt?${consulta}&X-Amz-Signature=${firma}`;
  if (credenciales.sessionToken) url += `&X-Amz-Security-Token=${encodeURIComponent(credenciales.sessionToken)}`;
  return url;
}
