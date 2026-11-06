// Temas MQTT y documentos de la sombra del foco, sin dependencias del navegador.

export const BRILLO_MINIMO = 10;
export const BRILLO_MAXIMO = 100;
const COLOR_HEX = /^#[0-9a-f]{6}$/i;

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
  const { encendido, color, brillo } = cambios;
  if (encendido !== undefined && typeof encendido !== "boolean") {
    throw new TypeError(`encendido debe ser true o false, no ${encendido}`);
  }
  if (color !== undefined && !COLOR_HEX.test(color)) {
    throw new TypeError(`color debe tener el formato #rrggbb, no ${color}`);
  }
  if (brillo !== undefined && !(Number.isInteger(brillo) && brillo >= BRILLO_MINIMO && brillo <= BRILLO_MAXIMO)) {
    throw new TypeError(`brillo debe ser un entero entre ${BRILLO_MINIMO} y ${BRILLO_MAXIMO}, no ${brillo}`);
  }
  const deseado = Object.fromEntries(
    Object.entries({ encendido, color: color?.toLowerCase(), brillo }).filter(([, valor]) => valor !== undefined),
  );
  return JSON.stringify({ state: { desired: deseado } });
}

// Resume un estado de la sombra: lo que el foco confirmó y si falta aplicar algo de lo pedido.
function resumir(estado = {}) {
  const reportado = estado.reported ?? null;
  const deseado = estado.desired ?? {};
  const pendiente = Object.entries(deseado).some(([campo, valor]) => reportado?.[campo] !== valor);
  return { reportado, pendiente };
}

// Mensaje del tema .../shadow/update/documents
export function leerDocumentos(texto) {
  return resumir(JSON.parse(texto).current?.state);
}

// Mensaje del tema .../shadow/get/accepted
export function leerGetAceptado(texto) {
  return resumir(JSON.parse(texto).state);
}
