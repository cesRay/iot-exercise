"""Lógica del puente: aplica los cambios de la sombra al foco y reporta el estado confirmado."""

import asyncio
import logging
from collections.abc import Callable

from foco_bridge.estado import EstadoFoco, aplicar_cambios
from foco_bridge.foco import Foco
from foco_bridge.shadow import Topicos, leer_delta, payload_reportado

log = logging.getLogger(__name__)

Publicar = Callable[[str, bytes], None]


class Puente:
    def __init__(self, foco: Foco, publicar: Publicar, topicos: Topicos) -> None:
        self._foco = foco
        self._publicar = publicar
        self._topicos = topicos
        self._estado: EstadoFoco | None = None
        self._candado = asyncio.Lock()

    async def sincronizar(self) -> None:
        """Lee el foco y reporta su estado. Si difiere del deseado, AWS IoT Core envía un delta."""
        async with self._candado:
            self._estado = await self._foco.leer()
            self._publicar(self._topicos.update, payload_reportado(self._estado))

    async def procesar_delta(self, payload: bytes) -> None:
        cambios = leer_delta(payload)
        if not cambios:
            return
        async with self._candado:
            actual = self._estado or await self._foco.leer()
            nuevo, invalidos = aplicar_cambios(actual, cambios)
            for campo, motivo in invalidos.items():
                log.warning("Cambio descartado en '%s': %s", campo, motivo)
            if nuevo != actual:
                try:
                    await self._foco.aplicar(nuevo)
                except Exception:
                    log.exception("El foco no aplicó el cambio. El estado reportado no cambia.")
                    if not invalidos:
                        return
                    nuevo = actual
            self._estado = nuevo
            self._publicar(self._topicos.update, payload_reportado(nuevo, descartar=invalidos))
