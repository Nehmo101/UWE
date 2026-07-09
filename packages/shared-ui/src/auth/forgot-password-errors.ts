export function formatForgotPasswordError(
  response: Response,
  payload: { error?: string },
): string {
  if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After");
    const seconds = retryAfter ? Number.parseInt(retryAfter, 10) : Number.NaN;
    const base = payload.error ?? "Zu viele Anfragen. Bitte warte einen Moment.";
    if (Number.isFinite(seconds) && seconds > 0) {
      const minutes = Math.ceil(seconds / 60);
      const waitLabel =
        seconds < 60 ? `${seconds} Sekunden` : `${minutes} Minute${minutes === 1 ? "" : "n"}`;
      return `${base} Versuche es in etwa ${waitLabel} erneut.`;
    }
    return base;
  }

  return payload.error ?? "Anfrage fehlgeschlagen. Bitte versuche es später erneut.";
}
