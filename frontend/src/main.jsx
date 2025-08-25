import React from "react";
import { createRoot } from "react-dom/client"; // Correct import for createRoot
import App from "./App";
import "./index.css";
// Import the Firebase configuration file to initialize the app
import "./config/firebase"; 

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
