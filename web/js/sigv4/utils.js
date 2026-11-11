const codificador = new TextEncoder();

export function aHex(buffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(texto) {
  return aHex(await crypto.subtle.digest("SHA-256", codificador.encode(texto)));
}

export async function hmac(clave, texto) {
  const material = typeof clave === "string" ? codificador.encode(clave) : clave;
  const llave = await crypto.subtle.importKey("raw", material, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", llave, codificador.encode(texto));
}

// Clave derivada de SigV4: una cadena de HMAC sobre la fecha, la región y el servicio.
export async function claveDeFirma(secreto, fecha, region, servicio) {
  let clave = await hmac(`AWS4${secreto}`, fecha);
  clave = await hmac(clave, region);
  clave = await hmac(clave, servicio);
  return hmac(clave, "aws4_request");
}

// Fecha en el formato de SigV4: 20261110T153000Z y 20261110.
export function fechaAmz(fecha) {
  const amzDate = fecha.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amzDate, dateStamp: amzDate.slice(0, 8) };
}
