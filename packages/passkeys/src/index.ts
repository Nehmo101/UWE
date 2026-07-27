export {
  deriveRequestOrigin,
  resolveWebAuthnRelyingParty,
  type WebAuthnRelyingParty,
} from "./webauthn-config";
export {
  createPasskeyRouteHandlers,
  type PasskeyAuditAction,
  type PasskeyAuditEvent,
  type PasskeyCredentialViewPort,
  type PasskeyDbHandle,
  type PasskeyLoginCredentialPort,
  type PasskeyRouteDeps,
  type PasskeyRouteHandlers,
  type PasskeyRouteUser,
  type PasskeyStorePort,
  type WebAuthnVerifierPort,
} from "./passkey-routes";
