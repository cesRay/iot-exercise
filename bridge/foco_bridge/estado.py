"""Estado del foco y validación de los cambios que llegan desde la sombra."""

import re
from dataclasses import dataclass, replace

BRILLO_MINIMO = 10
BRILLO_MAXIMO = 100
_COLOR_HEX = re.compile(r"#[0-9a-fA-F]{6}")


class CambioInvalido(ValueError):
    """Un campo del estado deseado tiene un valor que el foco no puede aplicar."""


@dataclass(frozen=True)
class EstadoFoco:
    encendido: bool
    color: str  # "#rrggbb" en minúsculas
    brillo: int  # de BRILLO_MINIMO a BRILLO_MAXIMO

    def a_dict(self) -> dict:
        return {"encendido": self.encendido, "color": self.color, "brillo": self.brillo}


ESTADO_INICIAL = EstadoFoco(encendido=False, color="#ffffff", brillo=BRILLO_MAXIMO)


def _validar_encendido(valor: object) -> bool:
    if not isinstance(valor, bool):
        raise CambioInvalido(f"encendido debe ser true o false, no {valor!r}")
    return valor


def _validar_color(valor: object) -> str:
    if not isinstance(valor, str) or not _COLOR_HEX.fullmatch(valor):
        raise CambioInvalido(f"color debe tener el formato #rrggbb, no {valor!r}")
    return valor.lower()


def _validar_brillo(valor: object) -> int:
    if isinstance(valor, bool) or not isinstance(valor, int):
        raise CambioInvalido(f"brillo debe ser un entero, no {valor!r}")
    if not BRILLO_MINIMO <= valor <= BRILLO_MAXIMO:
        raise CambioInvalido(f"brillo debe estar entre {BRILLO_MINIMO} y {BRILLO_MAXIMO}, no {valor}")
    return valor


_VALIDADORES = {
    "encendido": _validar_encendido,
    "color": _validar_color,
    "brillo": _validar_brillo,
}


def aplicar_cambios(actual: EstadoFoco, cambios: dict) -> tuple[EstadoFoco, dict[str, str]]:
    """Aplica los campos válidos. Devuelve el estado nuevo y los campos descartados con su motivo."""
    validos: dict[str, object] = {}
    invalidos: dict[str, str] = {}
    for campo, valor in cambios.items():
        validar = _VALIDADORES.get(campo)
        if validar is None:
            invalidos[campo] = "campo desconocido"
            continue
        try:
            validos[campo] = validar(valor)
        except CambioInvalido as error:
            invalidos[campo] = str(error)
    return replace(actual, **validos), invalidos
