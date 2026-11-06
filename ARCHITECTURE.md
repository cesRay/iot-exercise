# Arquitectura: foco RGB controlado por Internet

Demo de IoT (Internet de las cosas) para una presentación universitaria. Desde una página web en la laptop del presentador se controla el encendido, el color y el brillo de un foco RGB real. La orden viaja por Internet a través de AWS IoT Core hasta una Raspberry Pi, que actúa como gateway del foco.

## Objetivos y restricciones

- **Costo:** 0 MXN en servicios. La única compra es el foco (presupuesto máximo: 500 MXN).
- **Hardware disponible:** Raspberry Pi 4 con memoria SD de 32 GB (lenta). Sin componentes electrónicos adicionales.
- **Sin desarmar productos:** el foco se usa tal como viene de fábrica.
- **Separación real:** el publicador (laptop) y el sistema físico (Pi + foco) son independientes y solo se comunican por el broker.
- **Fecha de la presentación:** antes de 2026-12.

## Diagrama

```
  LAPTOP (publicador)                 AWS IoT Core (nube)              RASPBERRY PI (gateway)        FOCO WiZ
 ┌──────────────────────┐  MQTT/WSS  ┌──────────────────────────┐ MQTT/TLS ┌───────────────────────┐ UDP   ┌───────┐
 │ Página web           │ ─────────► │ Broker MQTT              │ ◄──────► │ Puente Python         │ ────► │  RGB  │
 │ (HTML local)         │ ◄───────── │ Device Shadow            │  8883    │ (awsiotsdk +          │ ◄──── │       │
 │ Credenciales Cognito │    443     │ "foco-aula"              │  X.509   │  pywizlight)          │ 38899 └───────┘
 └──────────────────────┘            └──────────────────────────┘          └───────────────────────┘
                                                                            Pi y foco en el hotspot
```

## Componentes

| Componente | Dónde corre | Responsabilidad |
|---|---|---|
| Página web | Laptop (archivo HTML abierto en el navegador, sin servidor) | Botón de encendido, selector de color y control de brillo. Escribe el estado `desired` en la sombra y muestra el estado `reported`. |
| AWS IoT Core | Nube de AWS | Broker MQTT. Registra el *thing* `foco-aula` y su Device Shadow. |
| Puente | Raspberry Pi (servicio del sistema) | Recibe los cambios de la sombra, los envía al foco por UDP y reporta el estado real del foco. |
| Foco WiZ | Red local (hotspot) | Recibe comandos UDP en el puerto 38899. Nunca habla con AWS directamente. |

## Flujo de datos (Device Shadow)

La sombra separa lo que se pide (`desired`) de lo que el foco confirma (`reported`). La página nunca asume que el foco cambió: espera la confirmación.

| Paso | Quién | Qué pasa |
|---|---|---|
| 1 | Página | Publica `{"state":{"desired":{"encendido":true,"color":"#ff6600","brillo":80}}}` en `$aws/things/foco-aula/shadow/update` |
| 2 | AWS IoT Core | Compara `desired` con `reported` y publica la diferencia en `$aws/things/foco-aula/shadow/update/delta` |
| 3 | Puente | Recibe el `delta` y envía el comando UDP al foco |
| 4 | Puente | Lee el estado real del foco y publica `reported` en `$aws/things/foco-aula/shadow/update` |
| 5 | Página | Recibe `$aws/things/foco-aula/shadow/update/documents` y actualiza la interfaz con el estado confirmado |

**Disponibilidad:** el puente registra un "último testamento" (*Last Will*) en el tema `aula/foco/disponible`. Si la Pi se desconecta, AWS IoT Core publica `offline` y la página lo muestra.

**Reconexión:** si la Pi está desconectada y alguien cambia el estado, AWS IoT Core guarda el `desired`. Cuando la Pi se vuelve a conectar, recibe el `delta` y el foco se actualiza solo.

## Seguridad

Cada actor tiene permisos mínimos.

- **Pi:** se autentica con un certificado X.509 propio. Su política solo permite conectarse con el ID de cliente `foco-aula` y usar los temas de la sombra de `foco-aula` y `aula/foco/disponible`.
- **Página web:** obtiene credenciales temporales de un *identity pool* (grupo de identidades) de Amazon Cognito con acceso de invitado, sin inicio de sesión. La política del rol de invitado solo permite:
  - conectarse con un ID de cliente que empiece por `web-`;
  - publicar en `$aws/things/foco-aula/shadow/update` y `$aws/things/foco-aula/shadow/get`;
  - suscribirse y recibir mensajes de las respuestas de esa sombra y de `aula/foco/disponible`.

  El rol de invitado no tiene acceso a ningún otro recurso de AWS.

## Red

La Pi, el foco y la laptop se conectan al hotspot del celular del presentador. Así la demo no depende del WiFi de la universidad, que suele bloquear la comunicación entre dispositivos o pedir inicio de sesión en un portal. El hotspot también da la salida a Internet hacia AWS IoT Core.

No hay cables entre la Pi y el foco. Los dos se conectan por WiFi al hotspot, y el puente envía los comandos UDP al foco por esa red. Cada dispositivo solo necesita su propia alimentación eléctrica.

**Banda de 2.4 GHz obligatoria:** los focos WiZ solo funcionan en la banda de 2.4 GHz. El hotspot debe usar esa banda:

- **iPhone:** activar "Maximizar compatibilidad" en la configuración de Compartir Internet.
- **Android:** elegir la banda de 2.4 GHz en la configuración del hotspot.

La Raspberry Pi 4 funciona en las bandas de 2.4 GHz y 5 GHz, así que no requiere cambios.

## Costo

| Concepto | Costo |
|---|---|
| Foco WiZ A19 multicolor (Amazon México) | Aproximadamente 235 MXN (compra única) |
| AWS IoT Core | 0 MXN. El uso de la demo (cientos de mensajes) se cubre con los créditos del plan gratuito de AWS. |
| Amazon Cognito (acceso de invitado) | 0 MXN, dentro de los créditos del plan gratuito |
| Socket con cable y clavija (portalámparas E26/E27), si no hay una lámpara disponible | Aproximadamente 50 a 100 MXN (compra única) |
| Raspberry Pi 4, cargador USB-C de 5 V / 3 A y memoria SD | 0 MXN (ya disponibles) |

La cuenta de AWS se creó en 2026-06 con el plan gratuito, que dura 6 meses y vence en 2026-12. Para conservar la cuenta después de esa fecha, hay que cambiarla al plan de pago antes de que venza. Se recomienda configurar una alerta de presupuesto (AWS Budgets) en 1 USD.

## Decisiones

### D1. Foco WiZ en lugar de otras marcas

WiZ acepta comandos JSON por UDP en la red local (puerto 38899), sin nube, sin claves y sin cuenta de desarrollador. La librería de Python `pywizlight` ya implementa el protocolo.

- **Requisito:** activar "Permitir comunicación local" en la app de WiZ.
- **Requisito:** el modelo debe ser "multicolor" o "de colores". Los modelos de solo blanco ajustable no sirven.
- **Requisito:** una red WiFi de 2.4 GHz. Ver la sección [Red](#red).
- **Descartadas:** Tuya/Smart Life (hay que extraer claves locales), TP-Link Tapo (requiere credenciales de la nube) y Philips Hue (requiere un Hue Bridge, fuera de presupuesto).

### D2. MQTT con publicación/suscripción en lugar de control directo

Un servidor que reciba HTTP y envíe UDP al foco sería más simple. Pero la demo es para enseñar IoT, y el patrón central del IoT es publicar/suscribir a través de un broker. Cada pieza de la demo corresponde a un concepto de las slides.

### D3. AWS IoT Core como broker

Se eligió AWS IoT Core en lugar de Mosquitto en la Pi o de un broker público.

- **A favor:** el control pasa por Internet de verdad (la laptop podría estar en cualquier lugar), y la autenticación es la de un sistema IoT de producción. Device Shadow implementa el modelo `desired`/`reported` como servicio estándar.
- **En contra:** depende de los datos móviles del hotspot y exige configurar Cognito para el navegador.
- **Descartado, Mosquitto en la Pi:** sin dependencia de Internet, pero no demuestra control remoto real.
- **Descartado, broker público (por ejemplo, HiveMQ):** cualquier persona puede publicar en el tema y controlar el foco.

### D4. La Raspberry Pi como gateway

Un navegador no puede enviar UDP, y el foco WiZ no puede conectarse a AWS IoT Core. Hace falta un puente. Se ejecuta en la Pi y no en la laptop para que el publicador y el sistema físico estén separados de verdad, como en un sistema IoT real.

La Pi usa Raspberry Pi OS Lite (sin escritorio) y se administra por SSH. Sin escritorio, la memoria SD lenta de 32 GB es suficiente.

### D5. Página web sin servidor

La página es un archivo HTML que se abre en el navegador de la laptop. No necesita hosting ni servidor propio. Se conecta a AWS IoT Core por MQTT sobre WebSockets seguros (puerto 443) con credenciales temporales de Cognito.

### D6. Hotspot del celular como red

Ver la sección [Red](#red).
