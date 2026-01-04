import { Link, useLocation } from "react-router-dom";

const linkStyle = (active: boolean): React.CSSProperties => ({
  padding: "8px 12px",
  borderRadius: 10,
  textDecoration: "none",
  border: "1px solid #ddd",
  background: active ? "#111" : "#fff",
  color: active ? "#fff" : "#111",
  fontSize: 14,
});

export function Navbar() {
  const loc = useLocation();
  const is = (p: string) => (p === "/" ? loc.pathname === "/" : loc.pathname.startsWith(p));

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "#fff",
        borderBottom: "1px solid #eee",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0", padding: 14, display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 900, marginRight: 10 }}>🍽️ Lunch</div>

        <Link to="/" style={linkStyle(is("/"))}>Dashboard</Link>
        <Link to="/calendar" style={linkStyle(is("/calendar"))}>Calendar</Link>
        <Link to="/profile" style={linkStyle(is("/profile"))}>Profil</Link>

        <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.7 }}>
          v1
        </div>
      </div>
    </div>
  );
}
