/** Read form field value — handles mobile autofill via FormData. */
export function readFormFieldValue(form: HTMLFormElement, name: string, fallback = ""): string {
  try {
    const fromForm = new FormData(form).get(name);
    if (typeof fromForm === "string" && fromForm.length > 0) {
      return fromForm;
    }
  } catch {
    // Non-browser test doubles may not implement FormData.
  }

  const control = form.elements.namedItem(name);
  if (control && "value" in control && typeof control.value === "string") {
    return control.value;
  }

  return fallback;
}

/** Full-page redirect after auth — reliable when session cookie was just set. */
export function redirectAfterAuth(redirectTo: string): void {
  window.location.assign(redirectTo);
}
