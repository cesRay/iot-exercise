// Temas MQTT y documentos de la sombra del foco, sin dependencias del navegador.

import { resumir, validarCambios } from "./utils.js";

export { Disponibilidad } from "./enums.js";

export function topicos(thingName, topicoDisponible) {
  const base = `$aws/things/${thingName}/shadow`;
  return {
    update: `${base}/update`,
    documentos: `${base}/update/documents`,
    rechazado: `${base}/update/rejected`,
    get: `${base}/get`,
    getAceptado: `${base}/get/accepted`,
    disponible: topicoDisponible,
  };
}

export function payloadDeseado(cambios) {
  validarCambios(cambios);
  const { encendido, color, brillo } = cambios;
  const deseado = Object.fromEntries(
    Object.entries({ encendido, color: color?.toLowerCase(), brillo }).filter(([, valor]) => valor !== undefined),
  );
  return JSON.stringify({ state: { desired: deseado } });
}

// Mensaje del tema .../shadow/update/documents
export function leerDocumentos(texto) {
  return resumir(JSON.parse(texto).current?.state);
}

// Mensaje del tema .../shadow/get/accepted
export function leerGetAceptado(texto) {
  return resumir(JSON.parse(texto).state);
}
