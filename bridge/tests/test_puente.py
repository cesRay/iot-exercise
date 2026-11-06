import json

from foco_bridge.estado import ESTADO_INICIAL, EstadoFoco
from foco_bridge.foco import FocoSimulado
from foco_bridge.puente import Puente
from foco_bridge.shadow import Topicos

TOPICOS = Topicos.para("foco-aula", "aula/foco/disponible")


class FocoQueFalla(FocoSimulado):
    async def aplicar(self, estado: EstadoFoco) -> None:
        raise TimeoutError("el foco no respondió")


def crear(foco):
    publicados: list[tuple[str, dict]] = []
    puente = Puente(foco, lambda topico, payload: publicados.append((topico, json.loads(payload))), TOPICOS)
    return puente, publicados


def delta(**cambios) -> bytes:
    return json.dumps({"version": 1, "state": cambios}).encode()


async def test_sincronizar_reporta_el_estado_del_foco():
    puente, publicados = crear(FocoSimulado())
    await puente.sincronizar()
    assert publicados == [(TOPICOS.update, {"state": {"reported": ESTADO_INICIAL.a_dict()}})]


async def test_un_delta_cambia_el_foco_y_reporta_el_estado_nuevo():
    foco = FocoSimulado()
    puente, publicados = crear(foco)
    await puente.sincronizar()
    await puente.procesar_delta(delta(encendido=True, color="#ff6600"))
    esperado = EstadoFoco(encendido=True, color="#ff6600", brillo=100)
    assert await foco.leer() == esperado
    assert publicados[-1] == (TOPICOS.update, {"state": {"reported": esperado.a_dict()}})


async def test_un_campo_invalido_se_borra_del_deseado():
    puente, publicados = crear(FocoSimulado())
    await puente.sincronizar()
    await puente.procesar_delta(delta(brillo=500))
    assert publicados[-1][1]["state"]["desired"] == {"brillo": None}
    assert publicados[-1][1]["state"]["reported"] == ESTADO_INICIAL.a_dict()


async def test_si_el_foco_falla_no_se_reporta_nada():
    puente, publicados = crear(FocoQueFalla())
    await puente.sincronizar()
    await puente.procesar_delta(delta(encendido=True))
    assert len(publicados) == 1


async def test_un_delta_vacio_se_ignora():
    puente, publicados = crear(FocoSimulado())
    await puente.procesar_delta(b"{}")
    assert publicados == []
