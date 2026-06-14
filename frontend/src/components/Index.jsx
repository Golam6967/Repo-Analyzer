import React, { useEffect, useRef } from "react";
import { useUser } from "@clerk/react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const PARTICLE_COUNT = 60;

function Particles() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.5 + 0.3,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      alpha: Math.random() * 0.5 + 0.1,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(170, 110, 255, ${p.alpha})`;
        ctx.fill();
      });

      // draw faint connection lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 110) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(170, 110, 255, ${0.08 * (1 - dist / 110)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: (i) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function Index() {
  const { isLoaded, isSignedIn, user } = useUser();
  const navigate = useNavigate();

  const firstName = user?.firstName || user?.username || "there";

  return (
    <>
      <Particles />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 32,
          padding: "0 24px",
          textAlign: "center",
        }}
      >
        {/* greeting / title */}
        {isLoaded && isSignedIn ? (
          <>
            <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show">
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "'Space Mono', monospace",
                  color: "var(--color-accent)",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  border: "1px solid rgba(180,125,255,0.25)",
                  padding: "4px 14px",
                  borderRadius: 20,
                }}
              >
                Welcome back
              </span>
            </motion.div>

            <motion.h1
              custom={1}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              style={{
                fontSize: "clamp(2.4rem, 6vw, 4.2rem)",
                fontWeight: 700,
                fontFamily: "'Rajdhani', sans-serif",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--ga)",
                textShadow: "0 0 40px rgba(180,125,255,0.50)",
                margin: 0,
                lineHeight: 1.1,
              }}
            >
              Hey, {firstName}
            </motion.h1>
          </>
        ) : (
          <>
            <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show">
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "'Space Mono', monospace",
                  color: "var(--color-accent)",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  border: "1px solid rgba(180,125,255,0.25)",
                  padding: "4px 14px",
                  borderRadius: 20,
                }}
              >
                Repo Visualizer
              </span>
            </motion.div>

            <motion.h1
              custom={1}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              style={{
                fontSize: "clamp(2.4rem, 6vw, 4.2rem)",
                fontWeight: 700,
                fontFamily: "'Rajdhani', sans-serif",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--ga)",
                textShadow: "0 0 40px rgba(180,125,255,0.50)",
                margin: 0,
                lineHeight: 1.1,
              }}
            >
              HoverBoard
            </motion.h1>
          </>
        )}

        <motion.p
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          style={{
            fontSize: "1.05rem",
            color: "rgba(255,255,255,0.45)",
            maxWidth: 520,
            fontFamily: "'Space Mono', monospace",
            lineHeight: 1.75,
            margin: 0,
          }}
        >
          {isSignedIn
            ? "Paste any GitHub URL to visualise its dependency graph and browse source files."
            : "Sign in to explore architecture maps and dependency graphs for any GitHub repository."}
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          custom={3}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}
        >
          {isLoaded && isSignedIn ? (
            <button
              onClick={() => navigate("/analyzer")}
              style={{
                padding: "12px 32px",
                fontFamily: "'Rajdhani', sans-serif",
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#0a0018",
                background: "var(--ga)",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                boxShadow: "0 0 24px rgba(180,125,255,0.45)",
                transition: "transform 0.15s, box-shadow 0.15s",
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = "translateY(-2px)";
                e.target.style.boxShadow = "0 0 36px rgba(180,125,255,0.65)";
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = "";
                e.target.style.boxShadow = "0 0 24px rgba(180,125,255,0.45)";
              }}
            >
              Open Analyzer →
            </button>
          ) : (
            <p
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 12,
                color: "rgba(255,255,255,0.3)",
                margin: 0,
              }}
            >
              Sign in via the navbar to get started.
            </p>
          )}
        </motion.div>

        {/* feature chips */}
        <motion.div
          custom={4}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}
        >
          {["D3 Force Graph", "Syntax Highlighting", "Cycle Detection", "Dep Tracing"].map((f) => (
            <span
              key={f}
              style={{
                fontSize: 10,
                fontFamily: "'Space Mono', monospace",
                color: "rgba(255,255,255,0.35)",
                border: "1px solid rgba(255,255,255,0.1)",
                padding: "4px 10px",
                borderRadius: 20,
              }}
            >
              {f}
            </span>
          ))}
        </motion.div>
      </div>
    </>
  );
}
