import mqtt from "https://unpkg.com/mqtt@5.16.1/dist/mqtt.esm.js";
import { credencialesInvitado } from "./cognito.js";
import { urlFirmada } from "./sigv4.js";

const ESPERA_RECONEXION_MS = 3000;
// Pulso (PINGREQ de MQTT) al broker cada 5 segundos. Si no hay respuesta, mqtt.js cierra la conexión.
const PULSO_SEGUNDOS = 5;

// Conecta el navegador a AWS IoT Core por MQTT sobre WebSockets.
// Si la conexión se cae, pide credenciales nuevas a Cognito y vuelve a conectar.
export function crearConexion(config, { suscripciones, alConectar, alMensaje, alCambiarEstado, alPulso }) {
  let cliente = null;

  function reintentar() {
    setTimeout(abrir, ESPERA_RECONEXION_MS);
  }

  async function abrir() {
    alCambiarEstado("conectando…");
    try {
      const credenciales = await credencialesInvitado(config.region, config.identityPoolId);
      const url = await urlFirmada({ host: config.endpoint, region: config.region, credenciales });
      const nuevo = mqtt.connect(url, {
        clientId: `web-${crypto.randomUUID()}`,
        protocolVersion: 4,
        clean: true,
        reconnectPeriod: 0,
        connectTimeout: 10_000,
        keepalive: PULSO_SEGUNDOS,
      });
      cliente = nuevo;
      let pulsoEnviado = 0;
      nuevo.on("packetsend", (paquete) => {
        if (paquete.cmd === "pingreq") pulsoEnviado = performance.now();
      });
      nuevo.on("packetreceive", (paquete) => {
        if (paquete.cmd === "pingresp") alPulso(Math.round(performance.now() - pulsoEnviado));
      });
      nuevo.on("connect", () => {
        nuevo.subscribe(suscripciones, { qos: 1 }, (error) => {
          if (error) {
            alCambiarEstado(`error al suscribirse: ${error.message}`);
            nuevo.end(true);
            return;
          }
          alCambiarEstado("conectado");
          alConectar();
        });
      });
      nuevo.on("message", (topico, payload) => alMensaje(topico, payload.toString()));
      nuevo.on("error", (error) => console.error("MQTT:", error));
      nuevo.on("close", () => {
        if (cliente !== nuevo) return;
        cliente = null;
        nuevo.end(true);
        alCambiarEstado("desconectado, reintentando…");
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
