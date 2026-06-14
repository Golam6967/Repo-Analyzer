import React, { useState, useEffect, useRef } from "react";
import { useUser, useAuth } from "@clerk/react";
import { motion } from "framer-motion";
import ErrorModal from "../components/ErrorModal";

const field = {
  label: { fontSize: 10, fontFamily: "'Space Mono', monospace", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, display: "block" },
  input: {
    width: "100%",
    padding: "10px 14px",
    background: "var(--color-background-secondary)",
    border: "1px solid var(--color-border-primary)",
    borderRadius: 6,
    color: "var(--color-text-primary)",
    fontFamily: "'Space Mono', monospace",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.08 } }),
};

export default function Profile() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [form, setForm] = useState({ name: "", birthDate: "", address: "" });
  const [preview, setPreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const { user: dbUser } = await res.json();
          setForm({
            name: dbUser.name || user?.fullName || "",
            birthDate: dbUser.birthDate ? dbUser.birthDate.slice(0, 10) : "",
            address: dbUser.address || "",
          });
          if (dbUser.imageUrl) setPreview(dbUser.imageUrl);
        }
      } catch {
        setForm({ name: user?.fullName || "", birthDate: "", address: "" });
      }
    };
    if (user) load();
  }, [user, getToken]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrorOpen(false);

    try {
      const token = await getToken();

      const fd = new FormData();
      fd.append("name", form.name);
      fd.append("birthDate", form.birthDate);
      fd.append("address", form.address);
      if (imageFile) fd.append("image", imageFile);

      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/users/profile`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      if (!res.ok) throw new Error("save_failed");

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setErrorOpen(true);
    } finally {
      setSaving(false);
    }
  };

  const avatarSrc = preview || user?.imageUrl;

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 600,
        margin: "0 auto",
        padding: "0 20px 60px",
      }}
    >
      <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show">
        <h1
          style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontSize: "2.2rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "var(--ga)",
            textShadow: "0 0 20px rgba(180,125,255,0.45)",
            marginBottom: 4,
          }}
        >
          Profile Settings
        </h1>
        <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 36 }}>
          Manage your account details and avatar
        </p>
      </motion.div>

      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Avatar */}
        <motion.div custom={1} variants={fadeUp} initial="hidden" animate="show"
          style={{ display: "flex", alignItems: "center", gap: 20 }}
        >
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              width: 88,
              height: 88,
              borderRadius: "50%",
              border: "2px solid var(--color-border-primary)",
              overflow: "hidden",
              cursor: "pointer",
              flexShrink: 0,
              position: "relative",
              background: "var(--color-background-secondary)",
            }}
          >
            {avatarSrc ? (
              <img src={avatarSrc} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, color: "var(--color-text-muted)" }}>
                {(form.name || user?.fullName || "?")[0]?.toUpperCase()}
              </div>
            )}
            <div style={{
              position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)",
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: 0, transition: "opacity 0.15s",
              fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#fff",
            }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = 0)}
            >
              Change
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} style={{ display: "none" }} />
          <div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: "var(--color-text-primary)", marginBottom: 4 }}>
              {form.name || user?.fullName || "No name set"}
            </div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "var(--color-text-muted)" }}>
              {user?.primaryEmailAddress?.emailAddress}
            </div>
          </div>
        </motion.div>

        {/* Name */}
        <motion.div custom={2} variants={fadeUp} initial="hidden" animate="show">
          <label style={field.label}>Display Name</label>
          <input
            style={field.input}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Your full name"
            onFocus={(e) => (e.target.style.borderColor = "var(--color-accent)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--color-border-primary)")}
          />
        </motion.div>

        {/* Birth Date */}
        <motion.div custom={3} variants={fadeUp} initial="hidden" animate="show">
          <label style={field.label}>Date of Birth</label>
          <input
            type="date"
            style={{ ...field.input, colorScheme: "dark" }}
            value={form.birthDate}
            onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))}
            onFocus={(e) => (e.target.style.borderColor = "var(--color-accent)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--color-border-primary)")}
          />
        </motion.div>

        {/* Address */}
        <motion.div custom={4} variants={fadeUp} initial="hidden" animate="show">
          <label style={field.label}>Address</label>
          <textarea
            style={{ ...field.input, resize: "vertical", minHeight: 80, lineHeight: 1.6 }}
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            placeholder="Your address"
            onFocus={(e) => (e.target.style.borderColor = "var(--color-accent)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--color-border-primary)")}
          />
        </motion.div>

        <ErrorModal
          open={errorOpen}
          onClose={() => setErrorOpen(false)}
          onRetry={() => { setErrorOpen(false); handleSave({ preventDefault: () => {} }); }}
        />

        <motion.div custom={5} variants={fadeUp} initial="hidden" animate="show">
          <button
            type="submit"
            disabled={saving}
            style={{
              width: "100%",
              padding: "12px 0",
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#0a0018",
              background: saved ? "var(--color-text-success)" : "var(--ga)",
              border: "none",
              borderRadius: 8,
              cursor: saving ? "wait" : "pointer",
              boxShadow: `0 0 20px ${saved ? "rgba(90,255,184,0.4)" : "rgba(180,125,255,0.35)"}`,
              transition: "background 0.3s, box-shadow 0.3s",
            }}
          >
            {saving ? "Saving···" : saved ? "✓ Saved" : "Save Changes"}
          </button>
        </motion.div>
      </form>
    </div>
  );
}
