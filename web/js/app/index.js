// Punto de entrada de la página: une la conexión con AWS IoT Core, la sombra y la vista.
import { CONFIG } from "../../config.js";
import { crearConexion, EstadoConexion } from "../iot/index.js";
import { Disponibilidad, leerDocumentos, leerGetAceptado, payloadDeseado, topicos } from "../sombra/index.js";
import { alEnviar, alExpirar, alRecibir, vistaInicial } from "../vista/index.js";
import { ESPERA_CONFIRMACION_MS, MENSAJE_SIN_CONFIRMACION, PAUSA_ENVIO_MS } from "./constants.js";
import { $, habilitar, mostrarMensaje, pintar } from "./dom.js";
import { TextoGateway } from "./enums.js";

const t = topicos(CONFIG.thingName, CONFIG.topicoDisponible);

let vista = vistaInicial();
let temporizador = null;
let retrasoEnvio = null;
let cambiosPorEnviar = {};

function revertir(mensaje) {
  clearTimeout(temporizador);
  clearTimeout(retrasoEnvio);
  cambiosPorEnviar = {};
  vista = alExpirar(vista);
  mostrarMensaje(mensaje);
  pintar(vista);
}

function recibir(resumen) {
  vista = alRecibir(vista, resumen);
  if (!vista.enviando) {
    clearTimeout(temporizador);
    mostrarMensaje("");
  }
  pintar(vista);
}

function publicarCambios() {
  conexion.publicar(t.update, payloadDeseado(cambiosPorEnviar));
  cambiosPorEnviar = {};
  temporizador = setTimeout(() => revertir(MENSAJE_SIN_CONFIRMACION), ESPERA_CONFIRMACION_MS);
}

// La página muestra el cambio de inmediato y lo envía a AWS IoT Core en segundo plano,
// cuando el control deja de moverse. Si el foco no lo confirma a tiempo, regresa al último estado confirmado.
function enviar(cambios) {
  vista = alEnviar(vista, cambios);
  cambiosPorEnviar = { ...cambiosPorEnviar, ...cambios };
  mostrarMensaje("");
  pintar(vista);
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
    if (texto !== EstadoConexion.CONECTADO) habilitar(false);
  },
  alPulso(milisegundos) {
    $("estado-conexion").textContent = `${EstadoConexion.CONECTADO} (${milisegundos} ms)`;
  },
  alMensaje(topico, texto) {
    if (topico === t.documentos) {
      recibir(leerDocumentos(texto));
    } else if (topico === t.getAceptado) {
      recibir(leerGetAceptado(texto));
    } else if (topico === t.disponible) {
      $("estado-gateway").textContent =
        texto === Disponibilidad.EN_LINEA ? TextoGateway.EN_LINEA : TextoGateway.FUERA_DE_LINEA;
    } else if (topico === t.rechazado) {
      revertir(`AWS rechazó el cambio: ${JSON.parse(texto).message}`);
    }
  },
});

habilitar(false);
$("encendido").addEventListener("click", () => enviar({ encendido: !vista.mostrado?.encendido }));
$("color").addEventListener("input", (evento) => enviar({ color: evento.target.value }));
$("brillo").addEventListener("input", (evento) => enviar({ brillo: Number(evento.target.value) }));
