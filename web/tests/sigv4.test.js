import { test } from "node:test";
import assert from "node:assert/strict";
import { urlFirmada } from "../js/sigv4/index.js";
import { claveDeFirma, fechaAmz } from "../js/sigv4/utils.js";

const aHex = (buffer) => Buffer.from(buffer).toString("hex");

test("claveDeFirma coincide con el ejemplo de la documentacion de AWS", async () => {
  // https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_sigv-create-signed-request.html
  const clave = await claveDeFirma("wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY", "20120215", "us-east-1", "iam");
  assert.equal(aHex(clave), "f4780e2d9f65fa895f9c67b32ce1baf0b0d8a43505a000a1a9e090d414db404d");
});

test("fechaAmz usa el formato basico ISO 8601 en UTC", () => {
  assert.deepEqual(fechaAmz(new Date("2026-11-05T19:48:07.123Z")), {
    amzDate: "20261105T194807Z",
    dateStamp: "20261105",
  });
});

test("urlFirmada agrega el token de sesion despues de la firma", async () => {
  const url = await urlFirmada({
    host: "ejemplo-ats.iot.us-east-1.amazonaws.com",
    region: "us-east-1",
    credenciales: {
      accessKeyId: "AKIDEXAMPLE",
      secretKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
      sessionToken: "token/con+simbolos=",
    },
    ahora: new Date("2026-11-05T19:48:07Z"),
  });
  assert.equal(
    url,
    "wss://ejemplo-ats.iot.us-east-1.amazonaws.com/mqtt" +
      "?X-Amz-Algorithm=AWS4-HMAC-SHA256" +
      "&X-Amz-Credential=AKIDEXAMPLE%2F20261105%2Fus-east-1%2Fiotdevicegateway%2Faws4_request" +
      "&X-Amz-Date=20261105T194807Z" +
      "&X-Amz-SignedHeaders=host" +
      "&X-Amz-Signature=97c681f999dd1dc5fa72da1ab80aca6fbe50c5918652c179f8258200798b1957" +
      "&X-Amz-Security-Token=token%2Fcon%2Bsimbolos%3D",
  );
});
