// Estado que muestra la página. Los cambios se muestran de inmediato (actualización optimista).
// - mostrado: lo que ve el usuario
// - confirmado: lo último que el foco confirmó (reported sin cambios pendientes)
// - enviando: hay un cambio enviado que el foco todavía no confirma

import { coinciden } from "./utils.js";

export function vistaInicial() {
  return { mostrado: null, confirmado: null, enviando: false };
}

export function alEnviar(vista, cambios) {
  return { ...vista, mostrado: { ...vista.mostrado, ...cambios }, enviando: true };
}

// `resumen` viene de leerDocumentos o leerGetAceptado: { reportado, pendiente }.
export function alRecibir(vista, { reportado, pendiente }) {
  const confirmado = pendiente ? vista.confirmado : reportado;
  if (vista.enviando) {
    // Con cambios propios en camino, solo una confirmación de lo que se muestra termina el envío.
    // Las confirmaciones intermedias actualizan `confirmado`, pero no lo mostrado.
    if (!pendiente && coinciden(reportado, vista.mostrado)) {
      return { mostrado: reportado, confirmado: reportado, enviando: false };
    }
    return { ...vista, confirmado };
  }
  return { mostrado: reportado ?? vista.mostrado, confirmado, enviando: false };
}

export function alExpirar(vista) {
  return { ...vista, mostrado: vista.confirmado, enviando: false };
}
