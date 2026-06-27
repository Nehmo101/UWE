import { redirect } from "next/navigation";

// The Cookbook admin module is deprecated. Local model management now lives on
// the RTX Connector page, where connector-reported models and workflow defaults
// are configured. We redirect with `from=cookbook` so the target shows a notice.
export default function CookbookAdminPage() {
  redirect("/system/rtx-connector?from=cookbook");
}
