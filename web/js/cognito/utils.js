import { PREFIJO_ACCION, TIPO_CONTENIDO } from "./constants.js";

// Llama a una acción del API de Cognito Identity. Estas acciones no requieren firma.
export async function llamar(region, accion, cuerpo) {
  const respuesta = await fetch(`https://cognito-identity.${region}.amazonaws.com/`, {
    method: "POST",
    headers: {
      "Content-Type": TIPO_CONTENIDO,
      "X-Amz-Target": `${PREFIJO_ACCION}.${accion}`,
    },
    body: JSON.stringify(cuerpo),
  });
  const datos = await respuesta.json();
  if (!respuesta.ok) {
    throw new Error(`Cognito ${accion}: ${datos.__type ?? respuesta.status} ${datos.message ?? ""}`);
  }
  return datos;
}
