// Credenciales temporales de invitado de Amazon Cognito (grupo de identidades sin inicio de sesión).
// Se piden con fetch, sin el SDK de AWS.

import { llamar } from "./utils.js";

export async function credencialesInvitado(region, identityPoolId) {
  const { IdentityId } = await llamar(region, "GetId", { IdentityPoolId: identityPoolId });
  const { Credentials } = await llamar(region, "GetCredentialsForIdentity", { IdentityId });
  return {
    accessKeyId: Credentials.AccessKeyId,
    secretKey: Credentials.SecretKey,
    sessionToken: Credentials.SessionToken,
  };
}
