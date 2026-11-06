from foco_bridge.estado import ESTADO_INICIAL, EstadoFoco, aplicar_cambios


def test_aplica_todos_los_campos_validos():
    nuevo, invalidos = aplicar_cambios(ESTADO_INICIAL, {"encendido": True, "color": "#FF6600", "brillo": 80})
    assert nuevo == EstadoFoco(encendido=True, color="#ff6600", brillo=80)
    assert invalidos == {}


def test_un_cambio_parcial_conserva_los_demas_campos():
    actual = EstadoFoco(encendido=True, color="#00ff00", brillo=50)
    nuevo, _ = aplicar_cambios(actual, {"brillo": 90})
    assert nuevo == EstadoFoco(encendido=True, color="#00ff00", brillo=90)


def test_descarta_valores_invalidos_y_aplica_los_validos():
    nuevo, invalidos = aplicar_cambios(
        ESTADO_INICIAL, {"encendido": "si", "color": "rojo", "brillo": 5, "parpadeo": True}
    )
    assert nuevo == ESTADO_INICIAL
    assert set(invalidos) == {"encendido", "color", "brillo", "parpadeo"}
    assert invalidos["parpadeo"] == "campo desconocido"


def test_brillo_no_acepta_booleanos_ni_decimales():
    _, invalidos = aplicar_cambios(ESTADO_INICIAL, {"brillo": True})
    assert "brillo" in invalidos
    _, invalidos = aplicar_cambios(ESTADO_INICIAL, {"brillo": 50.5})
    assert "brillo" in invalidos


def test_color_rechaza_texto_extra():
    _, invalidos = aplicar_cambios(ESTADO_INICIAL, {"color": "#ff6600\n"})
    assert "color" in invalidos
