import React from "react";
import ReactDOM from "react-dom/client";

import "@uwe/shared-ui/uwe.css";

import App from "./App";
import "./app.css";

document.documentElement.setAttribute("data-uwe-theme", "uwe-parchment-os");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
