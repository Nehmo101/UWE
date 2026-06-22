import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "./cn";

export function Table({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="uwe-table-wrap">
      <table className={cn("uwe-table", className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHead(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} />;
}

export function TableBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function TableRow(props: HTMLAttributes<HTMLTableRowElement>) {
  return <tr {...props} />;
}

export function TableHeader({
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("uwe-table-th", className)} {...props} />;
}

export function TableCell({
  className,
  label,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { label?: string }) {
  return (
    <td
      className={cn("uwe-table-td", className)}
      data-label={label}
      {...props}
    />
  );
}

export function TableCaption({
  children,
  ...props
}: HTMLAttributes<HTMLTableCaptionElement>) {
  return (
    <caption className="uwe-table-caption" {...props}>
      {children}
    </caption>
  );
}
