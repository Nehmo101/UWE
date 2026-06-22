/**
 * Read the current value of a named form control.
 * Uses FormData first so mobile browser autofill (which may skip React onChange)
 * is still picked up on submit.
 */
export function readFormFieldValue(form: HTMLFormElement, name: string, fallback = ""): string {
  try {
    const fromForm = new FormData(form).get(name);
    if (typeof fromForm === "string" && fromForm.length > 0) {
      return fromForm;
    }
  } catch {
    // Non-browser test doubles may not implement the FormData constructor hook.
  }

  const control = form.elements.namedItem(name);
  if (control && "value" in control && typeof control.value === "string") {
    return control.value;
  }

  return fallback;
}

/**
 * Full-page redirect after auth — more reliable than client-side router navigation
 * on mobile Safari when the session cookie was just set via fetch().
 */
export function redirectAfterAuth(redirectTo: string): void {
  window.location.assign(redirectTo);
}
