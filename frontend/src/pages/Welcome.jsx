import React from "react";
import Navbar from "../pages/Navbar";
import "../components/styles/Welcome.css";
import { Outlet, useLocation } from "react-router-dom";

export default function Welcome() {
  const location = useLocation();
  const isAnalyzer = location.pathname.includes("analyzer");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse at 30% 20%, rgba(60,60,60,0.18) 0%, transparent 55%), radial-gradient(ellipse at 70% 80%, rgba(30,30,30,0.22) 0%, transparent 55%), radial-gradient(circle at center, #0d0d0d 0%, #050505 65%, #000000 100%)",
        color: "#d8d8d8",
        fontFamily: "'Inter', sans-serif",
        position: "relative",
        overflow: isAnalyzer ? "hidden" : "auto",
      }}
    >
      <Navbar />

      <main
        style={
          isAnalyzer
            ? {
                // full-screen for the graph
                position: "fixed",
                inset: 0,
                top: 58,
                display: "flex",
                flexDirection: "column",
              }
            : {
                // centred hero for home / profile
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "100vh",
                textAlign: "center",
                paddingTop: "80px",
                paddingBottom: "60px",
                position: "relative",
                zIndex: 1,
              }
        }
      >
        <Outlet />
      </main>
    </div>
  );
}
