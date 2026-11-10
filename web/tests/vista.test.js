import { test } from "node:test";
import assert from "node:assert/strict";
import { alEnviar, alExpirar, alRecibir, vistaInicial } from "../js/vista.js";

const rojo = { encendido: true, color: "#ff0000", brillo: 80 };
const azul = { encendido: true, color: "#0000ff", brillo: 80 };

test("al enviar, la vista muestra el cambio de inmediato", () => {
  const vista = alRecibir(vistaInicial(), { reportado: rojo, pendiente: false });
  const nueva = alEnviar(vista, { color: "#0000ff" });
  assert.deepEqual(nueva.mostrado, azul);
  assert.deepEqual(nueva.confirmado, rojo);
  assert.equal(nueva.enviando, true);
});

test("un documento pendiente no regresa la vista al estado anterior", () => {
  const vista = alEnviar(alRecibir(vistaInicial(), { reportado: rojo, pendiente: false }), { color: "#0000ff" });
  const nueva = alRecibir(vista, { reportado: rojo, pendiente: true });
  assert.deepEqual(nueva.mostrado, azul);
  assert.equal(nueva.enviando, true);
});

test("la confirmacion actualiza lo mostrado y lo confirmado", () => {
  const vista = alEnviar(alRecibir(vistaInicial(), { reportado: rojo, pendiente: false }), { color: "#0000ff" });
  const nueva = alRecibir(vista, { reportado: azul, pendiente: false });
  assert.deepEqual(nueva, { mostrado: azul, confirmado: azul, enviando: false });
});

test("una confirmacion intermedia no regresa la vista a un cambio anterior", () => {
  const verde = { encendido: true, color: "#00ff00", brillo: 80 };
  let vista = alRecibir(vistaInicial(), { reportado: rojo, pendiente: false });
  vista = alEnviar(vista, { color: "#0000ff" });
  vista = alEnviar(vista, { color: "#00ff00" });
  vista = alRecibir(vista, { reportado: azul, pendiente: false });
  assert.deepEqual(vista, { mostrado: verde, confirmado: azul, enviando: true });
  vista = alRecibir(vista, { reportado: verde, pendiente: false });
  assert.deepEqual(vista, { mostrado: verde, confirmado: verde, enviando: false });
});

test("sin cambios propios en camino, muestra lo que reporta el foco", () => {
  const vista = alRecibir(alRecibir(vistaInicial(), { reportado: rojo, pendiente: false }), {
    reportado: azul,
    pendiente: false,
  });
  assert.deepEqual(vista, { mostrado: azul, confirmado: azul, enviando: false });
});

test("si nadie confirma, la vista regresa al ultimo estado confirmado", () => {
  const vista = alEnviar(alRecibir(vistaInicial(), { reportado: rojo, pendiente: false }), { color: "#0000ff" });
  assert.deepEqual(alExpirar(vista), { mostrado: rojo, confirmado: rojo, enviando: false });
});

test("al cargar con un cambio pendiente, muestra lo ultimo que reporto el foco", () => {
  const nueva = alRecibir(vistaInicial(), { reportado: rojo, pendiente: true });
  assert.deepEqual(nueva.mostrado, rojo);
  assert.equal(nueva.confirmado, null);
});
