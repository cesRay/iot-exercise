import mqtt from "https://unpkg.com/mqtt@5.16.1/dist/mqtt.esm.js";
import { credencialesInvitado } from "../cognito/index.js";
import { urlFirmada } from "../sigv4/index.js";
import { ESPERA_RECONEXION_MS, PULSO_SEGUNDOS, TIEMPO_MAXIMO_CONEXION_MS } from "./constants.js";
import { EstadoConexion } from "./enums.js";
import { medirPulso } from "./utils.js";

export { EstadoConexion } from "./enums.js";

// Conecta el navegador a AWS IoT Core por MQTT sobre WebSockets.
// Si la conexión se cae, pide credenciales nuevas a Cognito y vuelve a conectar.
export function crearConexion(config, { suscripciones, alConectar, alMensaje, alCambiarEstado, alPulso }) {
  let cliente = null;

  function reintentar() {
    setTimeout(abrir, ESPERA_RECONEXION_MS);
  }

  async function abrir() {
    alCambiarEstado(EstadoConexion.CONECTANDO);
    try {
      const credenciales = await credencialesInvitado(config.region, config.identityPoolId);
      const url = await urlFirmada({ host: config.endpoint, region: config.region, credenciales });
      const nuevo = mqtt.connect(url, {
        clientId: `web-${crypto.randomUUID()}`,
        protocolVersion: 4,
        clean: true,
        reconnectPeriod: 0,
        connectTimeout: TIEMPO_MAXIMO_CONEXION_MS,
        keepalive: PULSO_SEGUNDOS,
      });
      cliente = nuevo;
      medirPulso(nuevo, alPulso);
      nuevo.on("connect", () => {
        nuevo.subscribe(suscripciones, { qos: 1 }, (error) => {
          if (error) {
            alCambiarEstado(`error al suscribirse: ${error.message}`);
            nuevo.end(true);
            return;
          }
          alCambiarEstado(EstadoConexion.CONECTADO);
          alConectar();
        });
      });
      nuevo.on("message", (topico, payload) => alMensaje(topico, payload.toString()));
      nuevo.on("error", (error) => console.error("MQTT:", error));
      nuevo.on("close", () => {
        if (cliente !== nuevo) return;
        cliente = null;
        nuevo.end(true);
        alCambiarEstado(EstadoConexion.RECONECTANDO);
        reintentar();
      });
    } catch (error) {
      alCambiarEstado(`error: ${error.message}`);
      reintentar();
    }
  }

  abrir();
  return {
    publicar(topico, texto) {
      if (cliente?.connected) cliente.publish(topico, texto, { qos: 1 });
    },
  };
}
