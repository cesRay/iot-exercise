from pathlib import Path

from foco_bridge.config import cargar

CONFIG_COMPLETA = """
endpoint = "abc123-ats.iot.us-east-1.amazonaws.com"
thing_name = "foco-aula"
topico_disponible = "aula/foco/disponible"

[certificados]
cert = "certs/certificate.pem.crt"
key = "certs/private.pem.key"
ca = "certs/AmazonRootCA1.pem"

[foco]
ip = ""
broadcast = "172.20.10.15"
"""


def test_las_rutas_son_relativas_al_archivo(tmp_path: Path):
    ruta = tmp_path / "config.toml"
    ruta.write_text(CONFIG_COMPLETA)
    config = cargar(ruta)
    assert config.endpoint == "abc123-ats.iot.us-east-1.amazonaws.com"
    assert config.cert == tmp_path / "certs" / "certificate.pem.crt"
    assert config.ca == tmp_path / "certs" / "AmazonRootCA1.pem"


def test_ip_vacia_significa_descubrir_el_foco(tmp_path: Path):
    ruta = tmp_path / "config.toml"
    ruta.write_text(CONFIG_COMPLETA)
    assert cargar(ruta).foco_ip is None


def test_valores_por_omision(tmp_path: Path):
    ruta = tmp_path / "config.toml"
    ruta.write_text(
        'endpoint = "e"\nthing_name = "t"\n[certificados]\ncert = "c"\nkey = "k"\nca = "a"\n'
    )
    config = cargar(ruta)
    assert config.topico_disponible == "aula/foco/disponible"
    assert config.broadcast == "172.20.10.15"
    assert config.foco_ip is None
