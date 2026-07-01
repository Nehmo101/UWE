import * as React from "react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  /** Options as strings or {value,label}. Ignored if children are provided. */
  options?: (string | SelectOption)[];
}

export function Select(props: SelectProps): React.JSX.Element;
