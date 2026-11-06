"""Conversiones entre el formato de la sombra (#rrggbb, brillo 10-100) y el del foco WiZ (RGB y brillo 0-255)."""

from foco_bridge.estado import BRILLO_MAXIMO, BRILLO_MINIMO


def hex_a_rgb(color: str) -> tuple[int, int, int]:
    return int(color[1:3], 16), int(color[3:5], 16), int(color[5:7], 16)


def rgb_a_hex(rgb: tuple[int, int, int]) -> str:
    return "#{:02x}{:02x}{:02x}".format(*rgb)


def brillo_a_wiz(brillo: int) -> int:
    return round(brillo * 255 / 100)


def wiz_a_brillo(valor: int) -> int:
    return min(BRILLO_MAXIMO, max(BRILLO_MINIMO, round(valor * 100 / 255)))
