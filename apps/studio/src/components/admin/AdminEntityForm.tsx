import { Input, Select, Textarea } from "@uwe/shared-ui";

export type AdminEntitySelectField = {
  name: string;
  label: string;
  type: "select";
  options: Array<{ value: string; label: string }>;
  defaultValue?: string;
  required?: boolean;
};

export type AdminEntityTextareaField = {
  name: string;
  label: string;
  type: "textarea";
  rows?: number;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
};

export type AdminEntityInputField = {
  name: string;
  label: string;
  type?: "text" | "email" | "url" | "date" | "number";
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  min?: number;
};

export type AdminEntityField =
  | AdminEntitySelectField
  | AdminEntityTextareaField
  | AdminEntityInputField;

type AdminEntityFormProps = {
  action: string | ((formData: FormData) => void | Promise<void>);
  fields: AdminEntityField[];
  submitLabel?: string;
  submitClassName?: string;
  className?: string;
};

function renderField(field: AdminEntityField) {
  if (field.type === "select") {
    return (
      <Select
        key={field.name}
        name={field.name}
        label={field.label}
        defaultValue={field.defaultValue}
        required={field.required}
      >
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    );
  }

  if (field.type === "textarea") {
    return (
      <Textarea
        key={field.name}
        name={field.name}
        label={field.label}
        rows={field.rows ?? 3}
        placeholder={field.placeholder}
        defaultValue={field.defaultValue}
        required={field.required}
      />
    );
  }

  return (
    <Input
      key={field.name}
      name={field.name}
      label={field.label}
      type={field.type ?? "text"}
      placeholder={field.placeholder}
      defaultValue={field.defaultValue}
      required={field.required}
      min={field.min}
    />
  );
}

export function AdminEntityForm({
  action,
  fields,
  submitLabel = "Anlegen",
  submitClassName = "uwe-v2-btn uwe-v2-btn-primary",
  className,
}: AdminEntityFormProps) {
  return (
    <form action={action} className={className ?? "uwe-brain-create-form"}>
      {fields.map(renderField)}
      <button type="submit" className={submitClassName}>
        {submitLabel}
      </button>
    </form>
  );
}
