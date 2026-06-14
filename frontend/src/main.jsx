import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import NewRouter from "./Routing/Routing.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
      <NewRouter />
    </ClerkProvider>
  </StrictMode>,
);
