from foco_bridge.estado import ESTADO_INICIAL, EstadoFoco
from foco_bridge.foco import FocoSimulado


async def test_foco_simulado_empieza_apagado_y_guarda_el_ultimo_estado():
    foco = FocoSimulado()
    assert await foco.leer() == ESTADO_INICIAL
    nuevo = EstadoFoco(encendido=True, color="#ff0000", brillo=50)
    await foco.aplicar(nuevo)
    assert await foco.leer() == nuevo
