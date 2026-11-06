import json

from foco_bridge.estado import EstadoFoco
from foco_bridge.shadow import Topicos, leer_delta, payload_reportado


def test_topicos_de_la_sombra():
    topicos = Topicos.para("foco-aula", "aula/foco/disponible")
    assert topicos.update == "$aws/things/foco-aula/shadow/update"
    assert topicos.delta == "$aws/things/foco-aula/shadow/update/delta"
    assert topicos.disponible == "aula/foco/disponible"


def test_payload_reportado():
    estado = EstadoFoco(encendido=True, color="#ff6600", brillo=80)
    assert json.loads(payload_reportado(estado)) == {
        "state": {"reported": {"encendido": True, "color": "#ff6600", "brillo": 80}}
    }


def test_payload_reportado_borra_los_campos_descartados_del_deseado():
    estado = EstadoFoco(encendido=False, color="#ffffff", brillo=100)
    documento = json.loads(payload_reportado(estado, descartar=["brillo"]))
    assert documento["state"]["desired"] == {"brillo": None}


def test_leer_delta():
    payload = json.dumps({"version": 7, "state": {"color": "#00ff00"}, "metadata": {}}).encode()
    assert leer_delta(payload) == {"color": "#00ff00"}


def test_leer_delta_ignora_mensajes_rotos():
    assert leer_delta(b"no es json") == {}
    assert leer_delta(b"[1, 2]") == {}
    assert leer_delta(b'{"state": "texto"}') == {}
