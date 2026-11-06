// Credenciales temporales de invitado de Amazon Cognito (grupo de identidades sin inicio de sesión).
// Estas dos llamadas no requieren firma, así que se hacen con fetch, sin el SDK de AWS.

async function llamar(region, accion, cuerpo) {
  const respuesta = await fetch(`https://cognito-identity.${region}.amazonaws.com/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": `AWSCognitoIdentityService.${accion}`,
    },
    body: JSON.stringify(cuerpo),
  });
  const datos = await respuesta.json();
  if (!respuesta.ok) {
    throw new Error(`Cognito ${accion}: ${datos.__type ?? respuesta.status} ${datos.message ?? ""}`);
  }
  return datos;
}

export async function credencialesInvitado(region, identityPoolId) {
  const { IdentityId } = await llamar(region, "GetId", { IdentityPoolId: identityPoolId });
  const { Credentials } = await llamar(region, "GetCredentialsForIdentity", { IdentityId });
  return {
    accessKeyId: Credentials.AccessKeyId,
    secretKey: Credentials.SecretKey,
    sessionToken: Credentials.SessionToken,
  };
}
