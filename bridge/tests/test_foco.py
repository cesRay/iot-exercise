import asyncio

from foco_bridge.estado import ESTADO_INICIAL, EstadoFoco
from foco_bridge.foco import FocoSimulado, barrer, vecinos


async def test_foco_simulado_empieza_apagado_y_guarda_el_ultimo_estado():
    foco = FocoSimulado()
    assert await foco.leer() == ESTADO_INICIAL
    nuevo = EstadoFoco(encendido=True, color="#ff0000", brillo=50)
    await foco.aplicar(nuevo)
    assert await foco.leer() == nuevo


def test_vecinos_son_las_otras_direcciones_de_la_red():
    direcciones = vecinos("192.168.1.157")
    assert len(direcciones) == 253
    assert direcciones[0] == "192.168.1.1"
    assert direcciones[-1] == "192.168.1.254"
    assert "192.168.1.157" not in direcciones


async def test_barrer_devuelve_las_direcciones_que_responden_como_foco():
    class FocoFalso(asyncio.DatagramProtocol):
        def connection_made(self, transporte):
            self.transporte = transporte

        def datagram_received(self, datos, origen):
            self.transporte.sendto(b'{"method":"getPilot","env":"pro","result":{"state":true}}', origen)

    loop = asyncio.get_running_loop()
    servidor, _ = await loop.create_datagram_endpoint(FocoFalso, local_addr=("127.0.0.1", 0))
    puerto = servidor.get_extra_info("sockname")[1]
    try:
        assert await barrer(["127.0.0.1"], puerto=puerto, espera=0.3) == ["127.0.0.1"]
    finally:
        servidor.close()


async def test_barrer_sin_respuestas_devuelve_lista_vacia():
    assert await barrer(["127.0.0.1"], puerto=9, espera=0.2) == []
