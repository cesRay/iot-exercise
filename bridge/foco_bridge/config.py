"""Lectura del archivo de configuración del puente (config.toml)."""

import tomllib
from dataclasses import dataclass
from pathlib import Path

TOPICO_DISPONIBLE = "aula/foco/disponible"
# Difusión limitada: funciona en cualquier red, en casa o en el hotspot.
BROADCAST = "255.255.255.255"


@dataclass(frozen=True)
class Config:
    endpoint: str
    thing_name: str
    topico_disponible: str
    cert: Path
    key: Path
    ca: Path
    foco_ip: str | None
    broadcast: str


def cargar(ruta: Path) -> Config:
    """Lee config.toml. Las rutas de los certificados son relativas a la carpeta del archivo."""
    datos = tomllib.loads(ruta.read_text())
    base = ruta.parent
    certificados = datos["certificados"]
    foco = datos.get("foco", {})
    return Config(
        endpoint=datos["endpoint"],
        thing_name=datos["thing_name"],
        topico_disponible=datos.get("topico_disponible", TOPICO_DISPONIBLE),
        cert=base / certificados["cert"],
        key=base / certificados["key"],
        ca=base / certificados["ca"],
        foco_ip=foco.get("ip") or None,
        broadcast=foco.get("broadcast", BROADCAST),
    )
