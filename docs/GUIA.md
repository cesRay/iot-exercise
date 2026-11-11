# Guía de desarrollo: foco RGB controlado por Internet

Esta guía explica, paso a paso, cómo construir el proyecto desde cero: la infraestructura en AWS, la página web, el puente en la Raspberry Pi y el foco WiZ. Las razones de cada decisión están en [ARQUITECTURA.md](ARQUITECTURA.md).

## Qué vas a construir

```
Página web (laptop) ──MQTT/WSS──> AWS IoT Core ──MQTT/TLS──> Raspberry Pi (puente) ──UDP──> Foco WiZ
                                  (Device Shadow)
```

- **Página web:** corre en la laptop. Publica el estado deseado del foco en la sombra del dispositivo (Device Shadow). Usa credenciales de invitado de Amazon Cognito.
- **AWS IoT Core:** es el broker MQTT. Guarda la sombra `foco-aula` con el estado deseado (`desired`) y el estado reportado (`reported`).
- **Puente:** un programa de Python en la Raspberry Pi. Recibe los cambios de la sombra, los aplica al foco por la red local y reporta el resultado.
- **Foco WiZ:** recibe órdenes UDP en el puerto 38899 de la red local.

## Estructura del repositorio

| Carpeta | Contenido |
|---|---|
| `infra/` | Terraform: el dispositivo (thing), el certificado, las políticas, Cognito y la alerta de presupuesto |
| `bridge/` | El puente en Python, sus pruebas y el servicio systemd |
| `web/` | La página web (JavaScript sin frameworks) y sus pruebas |
| `docs/` | La arquitectura y esta guía |

En `web/js/`, cada módulo es una carpeta (`app`, `iot`, `sombra`, `sigv4`, `cognito`, `vista`). Dentro de cada carpeta, los archivos se separan por tipo de recurso:

| Archivo | Contenido |
|---|---|
| `index.js` | La interfaz pública del módulo. Los otros módulos solo importan de este archivo. |
| `constants.js` | Valores fijos, como tiempos de espera y límites |
| `enums.js` | Conjuntos cerrados de valores, como los estados de la conexión |
| `utils.js` | Funciones auxiliares internas del módulo |

Una carpeta solo tiene los archivos que necesita. `app/` también tiene `dom.js`, que lee y escribe los elementos de la página.

## 1. Requisitos

**Hardware:**
- Raspberry Pi 4 con un cargador USB-C de 5 V a 3 A.
- Memoria microSD de 16 GB o más, de una marca confiable (por ejemplo, SanDisk Ultra A1).
- Foco WiZ RGB con rosca E26/E27 y un portalámparas con cable y clavija.
- Un celular con hotspot, o una red Wi-Fi de 2.4 GHz.

**Cuentas:**
- Una cuenta de AWS. El uso de la demo cabe en el plan gratuito.
- Una cuenta de WiZ. La creas en la app WiZ Connected.

**Software en la laptop (macOS):**
- [Terraform](https://developer.hashicorp.com/terraform/install) 1.6 o más reciente: `brew install hashicorp/tap/terraform`
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) v2, con credenciales configuradas (`aws configure`).
- Python 3.11 o más reciente.
- Node 20 o más reciente. Solo se usa para las pruebas de la página.
- [Raspberry Pi Imager](https://www.raspberrypi.com/software/).

## 2. Crear la infraestructura en AWS

Toda la infraestructura usa la región `us-east-1`. AWS IoT Core no está disponible en `mx-central-1`.

1. Copia el archivo de variables y escribe tu correo. AWS Budgets te avisa a ese correo si el gasto llega a 0.80 USD.
   ```bash
   cp infra/terraform.tfvars.example infra/terraform.tfvars
   ```
2. Inicializa Terraform y revisa el plan:
   ```bash
   terraform -chdir=infra init
   terraform -chdir=infra plan -out=tfplan
   ```
   El plan crea unos 15 recursos.
3. Aplica el plan:
   ```bash
   terraform -chdir=infra apply tfplan
   rm infra/tfplan
   ```

Además de crear los recursos en AWS, Terraform genera tres archivos locales:

| Archivo | Contenido |
|---|---|
| `bridge/certs/` | El certificado X.509 del puente, su llave privada y el certificado raíz de Amazon |
| `bridge/config.toml` | El endpoint de AWS IoT Core y la configuración del puente |
| `web/config.js` | El endpoint y el ID del grupo de identidades de Cognito para la página |

Estos archivos y el estado de Terraform (`infra/terraform.tfstate`) contienen secretos. Están en `.gitignore`. Nunca los subas a git.

## 3. Probar sin hardware

Antes de tocar la Pi, prueba todo el flujo en la laptop con un foco simulado.

1. Instala el puente y corre sus pruebas:
   ```bash
   cd bridge
   python3 -m venv .venv
   .venv/bin/pip install -e ".[dev]"
   .venv/bin/pytest
   ```
2. Corre las pruebas de la página:
   ```bash
   cd web
   npm test
   ```
3. Inicia el puente con el foco simulado (en una pestaña de la terminal):
   ```bash
   cd bridge
   .venv/bin/python -m foco_bridge.main --config config.toml --simular
   ```
4. Inicia la página (en otra pestaña):
   ```bash
   cd web
   npm start
   ```
5. Abre http://localhost:8000. La página necesita `localhost` porque la firma de las peticiones usa Web Crypto, que solo funciona en un origen seguro.

Debes ver "Conexión con AWS: conectado (NN ms)" y "Gateway: en línea". Cuando cambias el color, el registro del puente muestra `Foco simulado: EstadoFoco(...)`.

Detén el puente simulado antes de iniciar el puente en la Pi. Los dos usan el mismo nombre en AWS IoT Core y se desconectarían entre sí.

## 4. Preparar la Raspberry Pi

### 4.1 Grabar el sistema operativo

1. Revisa la memoria SD nueva con [F3](https://github.com/AltraMayor/f3) para descartar una memoria falsificada.
2. En Raspberry Pi Imager, elige:
   - Dispositivo: Raspberry Pi 4.
   - Sistema operativo: Raspberry Pi OS (other) > Raspberry Pi OS Lite (64-bit).
   - Hostname: por ejemplo `cesray-pi-4`.
   - Usuario y contraseña: por ejemplo `cesray`. Si usas otro usuario, cámbialo también en `bridge/systemd/foco-bridge.service`.
   - Wi-Fi: la red donde vas a configurar la Pi, por ejemplo la de tu casa. Agregas las demás redes después.
   - SSH: activado, con contraseña.
3. Inserta la SD en la Pi y conecta la corriente. El primer arranque tarda de 2 a 5 minutos y la Pi se reinicia sola una vez.

### 4.2 Entrar por SSH

Conecta la laptop a la misma red que la Pi y entra:
```bash
ssh cesray@cesray-pi-4.local
```

Para que la conexión SSH sea estable, agrega esto a `~/.ssh/config` en la laptop:
```
Host cesray-pi-4.local
  ServerAliveInterval 30
  IPQoS none
```
- `ServerAliveInterval 30` evita que la conexión inactiva se cierre.
- `IPQoS none` evita que algunos routers caseros corten la conexión al pegar texto.

Si al entrar ves advertencias de `setlocale: LC_CTYPE`, desactiva en tu terminal la opción que define las variables de idioma (locale). En la Terminal de macOS es Settings > Profiles > Advanced > "Set locale environment variables on startup". Las advertencias no afectan el proyecto.

### 4.3 Configurar la red de la Pi

1. Actualiza el sistema:
   ```bash
   sudo apt update && sudo apt full-upgrade -y
   ```
2. Desactiva el ahorro de energía del Wi-Fi. Sin este paso, la Pi deja de responder por momentos y SSH se traba. Primero busca el nombre de la conexión (por ejemplo, `netplan-wlan0-MIRED`):
   ```bash
   nmcli connection show
   sudo nmcli connection modify "netplan-wlan0-MIRED" 802-11-wireless.powersave 2
   sudo reboot
   ```
3. Guarda el hotspot del celular como segunda red. La Pi usa automáticamente la red que encuentra disponible:
   ```bash
   sudo nmcli connection add type wifi ifname wlan0 con-name hotspot ssid "NOMBRE_DEL_HOTSPOT" \
     wifi-sec.key-mgmt wpa-psk wifi-sec.psk "CONTRASEÑA" 802-11-wireless.powersave 2
   ```
   El nombre del hotspot debe ser idéntico al que muestra el celular, con mayúsculas, espacios y acentos.

Para agregar otra red en el futuro, usa el mismo comando con otro `con-name`. No necesitas grabar la SD otra vez.

## 5. Configurar el foco WiZ

1. Instala la app **WiZ Connected** en el celular. WiZ Pro es para instalaciones profesionales y no sirve para este proyecto.
2. Crea una cuenta, un "home" y un cuarto. Los nombres no importan.
3. Conecta el celular a la misma red que la Pi y agrega el foco. El foco solo funciona en la banda de 2.4 GHz.
4. En Settings > Security, activa "Allow local" y selecciona **"Allow all controls"**. Con "Only verified controls", el foco rechaza los mensajes del puente.
5. Prueba que el foco cambia de color desde la app.

El foco guarda solo una red Wi-Fi. Cada vez que cambies de red, agrégalo otra vez con la app.

## 6. Instalar el puente en la Pi

1. Instala Python y rsync (en la Pi):
   ```bash
   sudo apt install -y python3-venv rsync
   ```
2. Copia el puente (en la laptop, en la raíz del repositorio). Esto incluye `config.toml` y `certs/`, que no están en git:
   ```bash
   rsync -av --exclude .venv --exclude __pycache__ --exclude '*.egg-info' --exclude .pytest_cache \
     bridge/ cesray@cesray-pi-4.local:~/foco-bridge/
   ```
3. Instala el puente en modo editable (en la Pi). Así, después de cada `rsync`, la Pi usa el código nuevo sin reinstalar:
   ```bash
   cd ~/foco-bridge
   python3 -m venv .venv
   .venv/bin/pip install -e .
   ```
4. Busca el foco en la red:
   ```bash
   .venv/bin/python -c "import asyncio; from foco_bridge.foco import descubrir; print(asyncio.run(descubrir('255.255.255.255')))"
   ```
   Debe responder con la IP del foco. Primero intenta con un mensaje de difusión (broadcast). Muchos módems bloquean ese mensaje, así que si nadie responde, el puente le pregunta a cada dirección de la red.
5. Inicia el puente a mano:
   ```bash
   .venv/bin/python -m foco_bridge.main --config config.toml
   ```
   Debes ver `Foco WiZ encontrado en ...` y `Puente listo`.
6. En la laptop, inicia la página (`cd web && npm start`) y abre http://localhost:8000. El foco real debe cambiar con el botón, el color y el brillo.

Detén el puente con `Ctrl + C` antes de instalar el servicio.

## 7. Instalar el servicio systemd

Con el servicio, el puente arranca solo cuando enciendes la Pi y se reinicia si falla.

```bash
sudo cp ~/foco-bridge/systemd/foco-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now foco-bridge
journalctl -u foco-bridge -f
```

Debes ver `Puente listo`. Sal del registro con `Ctrl + C`. El servicio sigue corriendo.

Para probar el arranque automático, reinicia la Pi con `sudo reboot`. Después de un minuto, la página debe mostrar el gateway "en línea" sin que inicies nada a mano.

## 8. Probar la sombra del dispositivo

La sombra guarda los cambios mientras la Pi está desconectada y los entrega cuando la Pi vuelve. Para probarlo, la laptop debe estar conectada y la Pi no.

1. Con el puente y la página funcionando, corta el acceso de la Pi a AWS IoT Core. Este bloqueo afecta solo el puerto 8883 (MQTT), así que SSH sigue funcionando:
   ```bash
   sudo apt install -y nftables   # solo si el comando nft no existe
   sudo nft add table inet prueba
   sudo nft add chain inet prueba salida '{ type filter hook output priority 0; }'
   sudo nft add rule inet prueba salida tcp dport 8883 drop
   ```
2. Espera a que la página muestre el gateway "fuera de línea". AWS publica ese mensaje (Last Will) cuando la Pi deja de responder.
3. Cambia el color en la página. Después de 5 segundos sin confirmación, la página regresa al último color confirmado. El cambio sigue guardado en la sombra como estado deseado.
4. Devuelve el acceso a la Pi:
   ```bash
   sudo nft delete table inet prueba
   ```
5. El puente se reconecta solo, recibe el cambio pendiente y lo aplica. El foco y la página cambian al color nuevo.

También puedes leer la sombra desde la laptop:
```bash
ENDPOINT="https://$(terraform -chdir=infra output -raw iot_endpoint)"
aws iot-data get-thing-shadow --region us-east-1 --endpoint-url "$ENDPOINT" \
  --thing-name foco-aula /dev/stdout | python3 -m json.tool
```

## 9. Desplegar cambios del puente

1. Copia el código (en la laptop):
   ```bash
   rsync -av --exclude .venv --exclude __pycache__ --exclude '*.egg-info' --exclude .pytest_cache \
     bridge/ cesray@cesray-pi-4.local:~/foco-bridge/
   ```
2. Si cambiaron las dependencias en `pyproject.toml`, reinstala (en la Pi): `cd ~/foco-bridge && .venv/bin/pip install -e .`
3. Reinicia el servicio (en la Pi): `sudo systemctl restart foco-bridge`

Para apagar la Pi sin dañar la SD, usa `sudo shutdown -h now` y desconecta la corriente cuando la luz verde deje de parpadear.

## 10. Antes de la clase

- [ ] Visita el aula y revisa la señal de datos del celular. Si el celular pierde los datos, el hotspot desaparece.
- [ ] Activa "Maximize Compatibility" en el hotspot del iPhone para usar la banda de 2.4 GHz.
- [ ] Deja abierta la pantalla Settings > Personal Hotspot mientras conectas los equipos. Si no, el iPhone puede dejar de anunciar la red.
- [ ] Cambia el foco al hotspot con la app WiZ y revisa que "Allow all controls" siga seleccionado.
- [ ] Conecta la laptop al hotspot y enciende la Pi. Entra con SSH y revisa el servicio: `systemctl status foco-bridge`.
- [ ] Abre la página y prueba el botón, el color y el brillo.

## Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| `ssh` no encuentra `cesray-pi-4.local` | La Pi no está en la misma red, o todavía está en el primer arranque | Espera 5 minutos. Revisa que la Pi tenga guardada la red (sección 4.3). Como alternativa, conéctala con un cable de red al router. |
| SSH se traba o muestra `Broken pipe` | Ahorro de energía del Wi-Fi de la Pi, o el router maneja mal la prioridad de SSH | Desactiva el ahorro de energía (sección 4.3) y agrega `IPQoS none` a `~/.ssh/config` |
| `Connection closed by ... port 22` justo después de escribir la contraseña | La Pi se reinició durante el primer arranque | Espera 2 minutos y vuelve a entrar |
| Luz roja fija y luz verde que nunca parpadea al encender | La Pi no puede leer la SD | Vuelve a insertar la SD. Si sigue igual, graba la SD otra vez. |
| `FocoNoEncontrado` | El foco está en otra red, apagado o con el control local desactivado | Revisa la red del foco y "Allow all controls" en la app WiZ. Revisa la comunicación directa: `.venv/bin/wizlight status IP_DEL_FOCO`. |
| La página dice "El foco no confirmó el cambio" | El puente no está corriendo o no llega a AWS | En la Pi: `systemctl status foco-bridge` y `journalctl -u foco-bridge -n 50` |
| La página dice "error: Failed to fetch" | La laptop no tiene internet | Revisa la conexión de la laptop |
| `aws iot-data` responde `ForbiddenException` | La AWS CLI usa otra región por omisión | Agrega `--region us-east-1` o corre `export AWS_REGION=us-east-1` |
| La página no refleja un cambio en el código | El navegador usa una versión guardada | Usa `npm start`, que sirve la página sin caché, y recarga |

## Borrar la infraestructura

Cuando ya no necesites la demo, borra los recursos de AWS:
```bash
terraform -chdir=infra destroy
```
Esto también invalida el certificado del puente. Para usar la demo otra vez, repite la sección 2 y copia los archivos nuevos a la Pi (sección 9).
