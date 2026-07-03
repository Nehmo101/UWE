import React from "react";
import ReactDOM from "react-dom/client";

import { applyThemePreferences } from "@uwe/shared-ui";
import "@uwe/shared-ui/uwe.css";

import App from "./App";
import "./app.css";

// Apply the UWE Parchment OS palette at boot. The shared theme engine only
// materialises the core colour tokens (--uwe-bg / --uwe-fg / --uwe-accent /
// --uwe-sidebar-bg / --uwe-card-bg …) at runtime, so the connector's own
// .connector-* styles — which consume those tokens — would otherwise fall back
// to the dark :root defaults instead of the warm parchment palette.
applyThemePreferences({
  themeId: "uwe-parchment-os",
  font: "mono",
  density: "comfortable",
  background: "none",
  frostedGlass: false,
  uiScale: 1,
  bgEffectIntensity: 1,
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
