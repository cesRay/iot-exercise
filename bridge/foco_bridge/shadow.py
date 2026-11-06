"""Temas MQTT y documentos JSON de la sombra (Device Shadow) de AWS IoT Core."""

import json
from collections.abc import Iterable
from dataclasses import dataclass

from foco_bridge.estado import EstadoFoco


@dataclass(frozen=True)
class Topicos:
    update: str
    delta: str
    disponible: str

    @classmethod
    def para(cls, thing_name: str, disponible: str) -> "Topicos":
        base = f"$aws/things/{thing_name}/shadow"
        return cls(update=f"{base}/update", delta=f"{base}/update/delta", disponible=disponible)


def payload_reportado(estado: EstadoFoco, descartar: Iterable[str] = ()) -> bytes:
    """Documento que reporta el estado real. Los campos de `descartar` se borran del estado deseado."""
    documento: dict = {"state": {"reported": estado.a_dict()}}
    campos = list(descartar)
    if campos:
        documento["state"]["desired"] = {campo: None for campo in campos}
    return json.dumps(documento).encode()


def leer_delta(payload: bytes) -> dict:
    """Extrae los cambios pendientes de un mensaje del tema delta. Devuelve {} si el mensaje no sirve."""
    try:
        documento = json.loads(payload)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {}
    estado = documento.get("state") if isinstance(documento, dict) else None
    return estado if isinstance(estado, dict) else {}
