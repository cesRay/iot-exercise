"""Punto de entrada: conecta el puente con AWS IoT Core y con el foco."""

import argparse
import asyncio
import logging
import signal
from pathlib import Path

from awscrt import mqtt
from awsiot import mqtt_connection_builder

from foco_bridge.config import Config, cargar
from foco_bridge.foco import FocoSimulado, FocoWiz
from foco_bridge.puente import Puente
from foco_bridge.shadow import Topicos

log = logging.getLogger("foco_bridge")


async def ejecutar(config: Config, simular: bool) -> None:
    loop = asyncio.get_running_loop()
    topicos = Topicos.para(config.thing_name, config.topico_disponible)
    foco = FocoSimulado() if simular else FocoWiz(config.foco_ip, config.broadcast)

    def publicar(topico: str, payload: bytes, retener: bool = False) -> None:
        conexion.publish(topic=topico, payload=payload, qos=mqtt.QoS.AT_LEAST_ONCE, retain=retener)

    puente = Puente(foco, publicar, topicos)

    async def al_reconectar(sesion_presente: bool) -> None:
        if not sesion_presente:
            await asyncio.wrap_future(conexion.resubscribe_existing_topics()[0])
        publicar(topicos.disponible, b"online", retener=True)
        await puente.sincronizar()

    # Las funciones de awscrt corren en otro hilo: los cambios se pasan al bucle de asyncio.
    def al_recibir_delta(topic: str, payload: bytes, **kwargs) -> None:
        asyncio.run_coroutine_threadsafe(puente.procesar_delta(payload), loop)

    def al_reanudar(connection, return_code, session_present: bool, **kwargs) -> None:
        log.info("Conexión con AWS IoT Core recuperada")
        asyncio.run_coroutine_threadsafe(al_reconectar(session_present), loop)

    def al_interrumpir(connection, error, **kwargs) -> None:
        log.warning("Conexión con AWS IoT Core interrumpida: %s", error)

    conexion = mqtt_connection_builder.mtls_from_path(
        endpoint=config.endpoint,
        cert_filepath=str(config.cert),
        pri_key_filepath=str(config.key),
        ca_filepath=str(config.ca),
        client_id=config.thing_name,
        clean_session=False,
        keep_alive_secs=30,
        will=mqtt.Will(topic=topicos.disponible, qos=mqtt.QoS.AT_LEAST_ONCE, payload=b"offline", retain=True),
        on_connection_interrupted=al_interrumpir,
        on_connection_resumed=al_reanudar,
    )

    log.info("Conectando a %s como %s", config.endpoint, config.thing_name)
    await asyncio.wrap_future(conexion.connect())
    suscripcion, _ = conexion.subscribe(
        topic=topicos.delta, qos=mqtt.QoS.AT_LEAST_ONCE, callback=al_recibir_delta
    )
    await asyncio.wrap_future(suscripcion)
    publicar(topicos.disponible, b"online", retener=True)
    await puente.sincronizar()
    log.info("Puente listo%s", " (foco simulado)" if simular else "")

    parar = asyncio.Event()
    for senal in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(senal, parar.set)
    await parar.wait()

    log.info("Cerrando el puente")
    despedida, _ = conexion.publish(
        topic=topicos.disponible, payload=b"offline", qos=mqtt.QoS.AT_LEAST_ONCE, retain=True
    )
    await asyncio.wrap_future(despedida)
    await asyncio.wrap_future(conexion.disconnect())


def main() -> None:
    parser = argparse.ArgumentParser(description="Puente entre AWS IoT Core y un foco WiZ")
    parser.add_argument("--config", type=Path, default=Path("config.toml"))
    parser.add_argument("--simular", action="store_true", help="usar un foco simulado en memoria")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    asyncio.run(ejecutar(cargar(args.config), args.simular))


if __name__ == "__main__":
    main()
