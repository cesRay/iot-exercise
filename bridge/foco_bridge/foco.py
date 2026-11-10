"""Acceso al foco: el foco WiZ real (UDP en la red local) y un foco simulado para desarrollar sin hardware."""

import asyncio
import ipaddress
import logging
import socket
from typing import Protocol

from pywizlight import PilotBuilder, wizlight
from pywizlight.discovery import discover_lights

from foco_bridge.color import brillo_a_wiz, hex_a_rgb, rgb_a_hex, wiz_a_brillo
from foco_bridge.estado import ESTADO_INICIAL, EstadoFoco

log = logging.getLogger(__name__)

PUERTO_WIZ = 38899
PREGUNTA_ESTADO = b'{"method":"getPilot","params":{}}'


class FocoNoEncontrado(RuntimeError):
    """No hay ningún foco WiZ que responda en la red."""


class Foco(Protocol):
    async def leer(self) -> EstadoFoco: ...

    async def aplicar(self, estado: EstadoFoco) -> None: ...


class FocoSimulado:
    """Guarda el estado en memoria. Sirve para probar el puente sin el foco."""

    def __init__(self, inicial: EstadoFoco = ESTADO_INICIAL) -> None:
        self._estado = inicial

    async def leer(self) -> EstadoFoco:
        return self._estado

    async def aplicar(self, estado: EstadoFoco) -> None:
        log.info("Foco simulado: %s", estado)
        self._estado = estado


def ip_local() -> str:
    """IP de la Pi en la red local. `connect` en UDP no envía nada: solo elige la interfaz de salida."""
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]


def vecinos(ip: str) -> list[str]:
    """Las otras direcciones de la red /24 de `ip`. Cubre la red de casa y la del hotspot (172.20.10.0/28)."""
    red = ipaddress.ip_network(f"{ip}/24", strict=False)
    return [str(host) for host in red.hosts() if str(host) != ip]


async def barrer(direcciones: list[str], puerto: int = PUERTO_WIZ, espera: float = 2.0) -> list[str]:
    """Pregunta su estado a cada dirección y devuelve las que responden como foco WiZ."""
    respuestas: list[str] = []

    class Receptor(asyncio.DatagramProtocol):
        def datagram_received(self, datos: bytes, origen: tuple) -> None:
            if b'"result"' in datos and origen[0] not in respuestas:
                respuestas.append(origen[0])

    transporte, _ = await asyncio.get_running_loop().create_datagram_endpoint(Receptor, local_addr=("0.0.0.0", 0))
    try:
        for direccion in direcciones:
            transporte.sendto(PREGUNTA_ESTADO, (direccion, puerto))
        await asyncio.sleep(espera)
    finally:
        transporte.close()
    return respuestas


async def descubrir(broadcast: str) -> str:
    """Busca un foco WiZ y devuelve su IP.

    Primero usa un mensaje de difusión (broadcast). Algunos módems no dejan pasar esos mensajes,
    así que si nadie responde, pregunta a cada dirección de la red.
    """
    focos = [foco.ip for foco in await discover_lights(broadcast_space=broadcast)]
    if not focos:
        log.info("Ningún foco respondió al broadcast %s. Se pregunta a cada dirección de la red.", broadcast)
        focos = await barrer(vecinos(ip_local()))
    if not focos:
        raise FocoNoEncontrado("No respondió ningún foco WiZ en la red")
    log.info("Foco WiZ encontrado en %s", focos[0])
    return focos[0]


class FocoWiz:
    """Foco WiZ real. Si no hay IP fija, lo busca en la red y lo vuelve a buscar cuando deja de responder."""

    def __init__(self, ip: str | None, broadcast: str, tiempo_maximo: float = 5.0) -> None:
        self._ip = ip
        self._broadcast = broadcast
        self._tiempo_maximo = tiempo_maximo
        self._luz_actual: wizlight | None = None

    async def leer(self) -> EstadoFoco:
        luz = await self._luz()
        estado = await asyncio.wait_for(luz.updateState(), self._tiempo_maximo)
        rgb = estado.get_rgb()
        brillo = estado.get_brightness()
        return EstadoFoco(
            encendido=bool(estado.get_state()),
            color=rgb_a_hex(rgb) if None not in rgb else ESTADO_INICIAL.color,
            brillo=wiz_a_brillo(brillo) if brillo is not None else ESTADO_INICIAL.brillo,
        )

    async def aplicar(self, estado: EstadoFoco) -> None:
        try:
            await self._enviar(estado)
        except Exception:
            log.warning("El foco no respondió. Se buscará de nuevo y se reintentará una vez.")
            await self._olvidar()
            await self._enviar(estado)

    async def _enviar(self, estado: EstadoFoco) -> None:
        luz = await self._luz()
        if estado.encendido:
            orden = luz.turn_on(PilotBuilder(rgb=hex_a_rgb(estado.color), brightness=brillo_a_wiz(estado.brillo)))
        else:
            orden = luz.turn_off()
        await asyncio.wait_for(orden, self._tiempo_maximo)

    async def _luz(self) -> wizlight:
        if self._luz_actual is None:
            ip = self._ip or await descubrir(self._broadcast)
            self._luz_actual = wizlight(ip)
        return self._luz_actual

    async def _olvidar(self) -> None:
        if self._luz_actual is not None:
            await self._luz_actual.async_close()
            self._luz_actual = None
