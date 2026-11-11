import { BRILLO_MAXIMO, BRILLO_MINIMO, COLOR_HEX } from "./constants.js";

export function validarCambios({ encendido, color, brillo }) {
  if (encendido !== undefined && typeof encendido !== "boolean") {
    throw new TypeError(`encendido debe ser true o false, no ${encendido}`);
  }
  if (color !== undefined && !COLOR_HEX.test(color)) {
    throw new TypeError(`color debe tener el formato #rrggbb, no ${color}`);
  }
  if (brillo !== undefined && !(Number.isInteger(brillo) && brillo >= BRILLO_MINIMO && brillo <= BRILLO_MAXIMO)) {
    throw new TypeError(`brillo debe ser un entero entre ${BRILLO_MINIMO} y ${BRILLO_MAXIMO}, no ${brillo}`);
  }
}

// Resume un estado de la sombra: lo que el foco confirmó y si falta aplicar algo de lo pedido.
export function resumir(estado = {}) {
  const reportado = estado.reported ?? null;
  const deseado = estado.desired ?? {};
  const pendiente = Object.entries(deseado).some(([campo, valor]) => reportado?.[campo] !== valor);
  return { reportado, pendiente };
}
