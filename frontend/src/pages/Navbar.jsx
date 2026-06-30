import { useEffect, useRef, useCallback, useState } from "react";
import { SignInButton, SignUpButton, UserButton, useUser, useAuth } from "@clerk/react";
import { Ghost, Search as SearchIcon } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import "../components/styles/Navbar.css";

const NAV_LINKS = [
  { label: "Home",     path: "/" },
  { label: "Analyzer", path: "/analyzer" },
  { label: "Profile",  path: "/profile", requireAuth: true },
];

const PAGE_LABELS = {
  "/":         "Home",
  "/analyzer": "Analyzer",
  "/profile":  "Profile",
};

function currentPageLabel(pathname) {
  if (pathname.startsWith("/analyzer")) return "Analyzer";
  if (pathname.startsWith("/profile"))  return "Profile";
  return "Home";
}

export default function Navbar() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { isSignedIn, isLoaded } = useUser();
  const { getToken } = useAuth();

  const navRef       = useRef(null);
  const indicatorRef = useRef(null);
  const linkRefs     = useRef({});

  const visibleLinks = NAV_LINKS.filter((l) => !l.requireAuth || isSignedIn);

  /* ── Sync user to backend on sign-in ── */
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const syncUser = async () => {
      try {
        const token = await getToken();
        await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (err) {
        console.error("Failed to sync user with backend:", err);
      }
    };
    syncUser();
  }, [isSignedIn, isLoaded]);

  /* ── Mouse-tracking spotlight ── */
  const handleMouseMove = useCallback((e) => {
    if (!navRef.current) return;
    const rect = navRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width)  * 100;
    const y = ((e.clientY - rect.top)  / rect.height) * 100;
    navRef.current.style.setProperty("--mx", `${x}%`);
    navRef.current.style.setProperty("--my", `${y}%`);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (!navRef.current) return;
    navRef.current.style.setProperty("--mx", "50%");
    navRef.current.style.setProperty("--my", "50%");
  }, []);

  /* ── Sliding active indicator ── */
  const updateIndicator = useCallback(() => {
    if (!indicatorRef.current) return;
    const container = indicatorRef.current.parentElement;
    if (!container) return;

    const activeLink = visibleLinks.find((l) =>
      l.path === "/" ? location.pathname === l.path : location.pathname.startsWith(l.path)
    );

    if (activeLink && linkRefs.current[activeLink.label]) {
      const el  = linkRefs.current[activeLink.label];
      const cr  = container.getBoundingClientRect();
      const er  = el.getBoundingClientRect();
      Object.assign(indicatorRef.current.style, {
        left:    `${er.left - cr.left}px`,
        width:   `${er.width}px`,
        opacity: "1",
      });
    } else {
      indicatorRef.current.style.opacity = "0";
    }
  }, [location.pathname, visibleLinks]);

  useEffect(() => {
    const t = setTimeout(updateIndicator, 60);
    window.addEventListener("resize", updateIndicator);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", updateIndicator);
    };
  }, [updateIndicator]);

  const pageLabel = currentPageLabel(location.pathname);

  return (
    <div className="navbar-3d-wrapper">
      <nav
        ref={navRef}
        className="navbar-3d"
        style={{
          background: "linear-gradient(180deg, rgba(20,20,20,0.94) 0%, rgba(5,5,5,0.97) 100%)",
          backdropFilter: "blur(24px) saturate(120%)",
          WebkitBackdropFilter: "blur(24px) saturate(120%)",
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* ── Logo ── */}
        <div
          style={{ display: "flex", gap: "9px", alignItems: "center", cursor: "pointer", position: "relative", zIndex: 1 }}
          onClick={() => navigate("/")}
        >
          <div className="logo-icon-wrap">
            <Ghost size={18} strokeWidth={1.8} />
          </div>
          <span className="logo-text-3d">HoverBoard</span>
        </div>

        {/* ── Nav Links with sliding indicator ── */}
        <div className="nav-links-3d">
          <div ref={indicatorRef} className="nav-indicator" />

          {visibleLinks.map((link) => {
            const isActive =
              link.path === "/"
                ? location.pathname === link.path
                : location.pathname.startsWith(link.path);
            return (
              <button
                key={link.label}
                ref={(el) => { linkRefs.current[link.label] = el; }}
                className={`nav-link-3d${isActive ? " active-3d" : ""}`}
                onClick={() => navigate(link.path)}
              >
                {link.label}
              </button>
            );
          })}
        </div>

        {/* ── Right section ── */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", position: "relative", zIndex: 1 }}>
          {/* Current page badge */}
          <span className="navbar-page-badge">{pageLabel}</span>

          <div className="nav-separator" />

          <button className="icon-btn-3d" title="Search (/ shortcut)">
            <SearchIcon size={15} strokeWidth={1.8} />
          </button>

          {isSignedIn ? (
            <UserButton
              appearance={{
                elements: {
                  avatarBox: { width: 32, height: 32 },
                  userButtonPopoverCard: {
                    background: "var(--g3)",
                    border: "1px solid rgba(200,200,200,0.16)",
                  },
                },
              }}
            />
          ) : (
            <>
              <SignInButton mode="modal">
                <button className="auth-btn signin-btn">Sign In</button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="auth-btn signup-btn">Sign Up</button>
              </SignUpButton>
            </>
          )}
        </div>
      </nav>

      <div className="navbar-3d-depth-1" />
      <div className="navbar-3d-depth-2" />
      <div className="navbar-3d-shadow" />
    </div>
  );
}
