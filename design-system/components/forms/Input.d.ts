import * as React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Optional stacked label above the field. */
  label?: React.ReactNode;
  /** Optional hint text below the field. */
  hint?: React.ReactNode;
}

export function Input(props: InputProps): React.JSX.Element;
/** The shared field style object (input/textarea/select) for custom fields. */
export const uweFieldStyle: React.CSSProperties;
