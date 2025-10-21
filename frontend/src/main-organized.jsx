import React from "react";
import { createRoot } from "react-dom/client";
import AppOrganized from "./App-Organized";
import "./index.css";

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <AppOrganized />
    </React.StrictMode>
  );
}
