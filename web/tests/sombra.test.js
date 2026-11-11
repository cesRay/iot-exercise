import { test } from "node:test";
import assert from "node:assert/strict";
import { leerDocumentos, leerGetAceptado, payloadDeseado, topicos } from "../js/sombra/index.js";

test("topicos de la sombra", () => {
  const t = topicos("foco-aula", "aula/foco/disponible");
  assert.equal(t.update, "$aws/things/foco-aula/shadow/update");
  assert.equal(t.documentos, "$aws/things/foco-aula/shadow/update/documents");
  assert.equal(t.getAceptado, "$aws/things/foco-aula/shadow/get/accepted");
  assert.equal(t.disponible, "aula/foco/disponible");
});

test("payloadDeseado solo incluye los campos enviados", () => {
  assert.deepEqual(JSON.parse(payloadDeseado({ color: "#FF6600" })), { state: { desired: { color: "#ff6600" } } });
  assert.deepEqual(JSON.parse(payloadDeseado({ encendido: true, brillo: 80 })), {
    state: { desired: { encendido: true, brillo: 80 } },
  });
});

test("payloadDeseado rechaza valores invalidos", () => {
  assert.throws(() => payloadDeseado({ encendido: "si" }), TypeError);
  assert.throws(() => payloadDeseado({ color: "rojo" }), TypeError);
  assert.throws(() => payloadDeseado({ brillo: 5 }), TypeError);
  assert.throws(() => payloadDeseado({ brillo: 50.5 }), TypeError);
});

test("leerDocumentos: confirmado cuando reportado coincide con deseado", () => {
  const texto = JSON.stringify({
    current: { state: { desired: { color: "#ff6600" }, reported: { encendido: true, color: "#ff6600", brillo: 80 } } },
  });
  assert.deepEqual(leerDocumentos(texto), {
    reportado: { encendido: true, color: "#ff6600", brillo: 80 },
    pendiente: false,
  });
});

test("leerDocumentos: pendiente cuando falta aplicar algo", () => {
  const texto = JSON.stringify({
    current: { state: { desired: { color: "#00ff00" }, reported: { encendido: true, color: "#ff6600", brillo: 80 } } },
  });
  assert.equal(leerDocumentos(texto).pendiente, true);
});

test("leerGetAceptado sin reportado todavia", () => {
  const texto = JSON.stringify({ state: { desired: { encendido: true } } });
  assert.deepEqual(leerGetAceptado(texto), { reportado: null, pendiente: true });
});
