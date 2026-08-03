import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import "./app.css";
import "./styles/tokens.css";
import "./styles/globals.css";
import "./styles/command-center.css";
import "./styles/command-center-maintenance.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
