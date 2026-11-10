import { CONFIG } from "../config.js";
import { leerDocumentos, leerGetAceptado, payloadDeseado, topicos } from "./estado.js";
import { crearConexion } from "./iot.js";
import { alEnviar, alExpirar, alRecibir, vistaInicial } from "./vista.js";

const ESPERA_CONFIRMACION_MS = 5000;
// Pausa sin cambios antes de enviar: evita un mensaje por cada píxel que se mueve un control.
const PAUSA_ENVIO_MS = 150;
const t = topicos(CONFIG.thingName, CONFIG.topicoDisponible);
const $ = (id) => document.getElementById(id);
const controles = [$("encendido"), $("color"), $("brillo")];

let vista = vistaInicial();
let temporizador = null;
let retrasoEnvio = null;
let cambiosPorEnviar = {};

function habilitar(activo) {
  for (const control of controles) control.disabled = !activo;
}

function pintar() {
  $("estado-foco").textContent = vista.enviando ? "aplicando cambio…" : vista.confirmado ? "confirmado" : "sin datos";
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

function revertir(mensaje) {
  clearTimeout(temporizador);
  clearTimeout(retrasoEnvio);
  cambiosPorEnviar = {};
  vista = alExpirar(vista);
  $("mensaje").textContent = mensaje;
  pintar();
}

function recibir(resumen) {
  vista = alRecibir(vista, resumen);
  if (!vista.enviando) {
    clearTimeout(temporizador);
    $("mensaje").textContent = "";
  }
  pintar();
}

function publicarCambios() {
  conexion.publicar(t.update, payloadDeseado(cambiosPorEnviar));
  cambiosPorEnviar = {};
  temporizador = setTimeout(
    () => revertir("El foco no confirmó el cambio. Revisa que la Raspberry Pi y el foco estén encendidos."),
    ESPERA_CONFIRMACION_MS,
  );
}

// La página muestra el cambio de inmediato y lo envía a AWS IoT Core en segundo plano,
// cuando el control deja de moverse. Si el foco no lo confirma a tiempo, regresa al último estado confirmado.
function enviar(cambios) {
  vista = alEnviar(vista, cambios);
  cambiosPorEnviar = { ...cambiosPorEnviar, ...cambios };
  $("mensaje").textContent = "";
  pintar();
  clearTimeout(temporizador);
  clearTimeout(retrasoEnvio);
  retrasoEnvio = setTimeout(publicarCambios, PAUSA_ENVIO_MS);
}

const conexion = crearConexion(CONFIG, {
  suscripciones: [t.documentos, t.rechazado, t.getAceptado, t.disponible],
  alConectar() {
    habilitar(true);
    conexion.publicar(t.get, "");
  },
  alCambiarEstado(texto) {
    $("estado-conexion").textContent = texto;
    if (texto !== "conectado") habilitar(false);
  },
  alPulso(milisegundos) {
    $("estado-conexion").textContent = `conectado (${milisegundos} ms)`;
  },
  alMensaje(topico, texto) {
    if (topico === t.documentos) {
      recibir(leerDocumentos(texto));
    } else if (topico === t.getAceptado) {
      recibir(leerGetAceptado(texto));
    } else if (topico === t.disponible) {
      $("estado-gateway").textContent = texto === "online" ? "en línea" : "fuera de línea";
    } else if (topico === t.rechazado) {
      revertir(`AWS rechazó el cambio: ${JSON.parse(texto).message}`);
    }
  },
});

habilitar(false);
$("encendido").addEventListener("click", () => enviar({ encendido: !vista.mostrado?.encendido }));
$("color").addEventListener("input", (evento) => enviar({ color: evento.target.value }));
$("brillo").addEventListener("input", (evento) => enviar({ brillo: Number(evento.target.value) }));
