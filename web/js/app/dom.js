// Lectura y escritura de los elementos de la página.
import { TextoFoco } from "./enums.js";

export const $ = (id) => document.getElementById(id);

const controles = () => [$("encendido"), $("color"), $("brillo")];

export function habilitar(activo) {
  for (const control of controles()) control.disabled = !activo;
}

export function mostrarMensaje(texto) {
  $("mensaje").textContent = texto;
}

export function pintar(vista) {
  $("estado-foco").textContent = vista.enviando
    ? TextoFoco.APLICANDO
    : vista.confirmado
      ? TextoFoco.CONFIRMADO
      : TextoFoco.SIN_DATOS;
  if (!vista.mostrado) return;
  const { encendido, color, brillo } = vista.mostrado;
  const foco = $("foco");
  foco.style.backgroundColor = encendido ? color : "";
  foco.style.opacity = encendido ? String(0.4 + (0.6 * brillo) / 100) : "";
  foco.style.boxShadow = encendido ? `0 0 ${brillo}px ${brillo / 3}px ${color}` : "";
  $("encendido").textContent = encendido ? "Apagar" : "Encender";
  $("color").value = color;
  $("brillo").value = String(brillo);
  $("brillo-valor").value = String(brillo);
}
