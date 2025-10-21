import React from "react";
import { createRoot } from "react-dom/client"; // Correct import for createRoot
import AppOrganized from "./App-Organized";
import "./index.css";
// Using organized backend instead of Firebase 

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <AppOrganized />
    </React.StrictMode>
  );
}
