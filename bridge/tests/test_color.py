import pytest

from foco_bridge.color import brillo_a_wiz, hex_a_rgb, rgb_a_hex, wiz_a_brillo


def test_hex_a_rgb():
    assert hex_a_rgb("#ff6600") == (255, 102, 0)


def test_rgb_a_hex_usa_minusculas_y_dos_digitos():
    assert rgb_a_hex((255, 10, 0)) == "#ff0a00"


@pytest.mark.parametrize("brillo", [10, 37, 50, 80, 100])
def test_el_brillo_sobrevive_la_ida_y_vuelta(brillo):
    assert wiz_a_brillo(brillo_a_wiz(brillo)) == brillo


def test_wiz_a_brillo_respeta_el_minimo():
    assert wiz_a_brillo(0) == 10
