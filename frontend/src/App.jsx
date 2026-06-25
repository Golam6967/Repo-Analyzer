import React from "react";
import { Toaster } from "react-hot-toast";
import NewRouter from "./Routing/Routing";
import "./App.css";

function App() {
  return (
    <>
      <NewRouter />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: { background: "#100d1a", color: "#e8e0f5", border: "1px solid #2d2340", fontFamily: "Space Mono", fontSize: 12 },
          success: { iconTheme: { primary: "#5affb8", secondary: "#100d1a" } },
          error: { iconTheme: { primary: "#ff4455", secondary: "#100d1a" } },
        }}
      />
    </>
  );
}

export default App;
