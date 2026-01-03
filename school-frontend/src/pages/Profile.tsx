import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { apiGet, apiPatch } from "../api/http";

type Child = { id: string; name: string; class: string; allergies?: any };
type MeResponse = { user: { email: string; role: string }; children: Child[] };

function prettyAllergies(a: any): string {
  if (!a) return "—";
  if (Array.isArray(a)) return a.join(", ");
  if (typeof a === "string") return a;
  return JSON.stringify(a);
}

export function Profile() {
  const { token, authenticated } = useAuth();
  const usersBase = import.meta.env.VITE_USERS_BASE;

  const [me, setMe] = useState<MeResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  // edit state per child
  const [edit, setEdit] = useState<Record<string, { name: string; class: string; allergiesText: string }>>({});

  useEffect(() => {
    if (!authenticated || !token) return;
    (async () => {
      try {
        setErr(null);
        const res = await apiGet<MeResponse>(`${usersBase}/users/me`, token);
        setMe(res);

        const next: any = {};
        for (const c of res.children ?? []) {
          next[c.id] = {
            name: c.name ?? "",
            class: c.class ?? "",
            allergiesText: c.allergies ? prettyAllergies(c.allergies) : "",
          };
        }
        setEdit(next);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load profile");
      }
    })();
  }, [authenticated, token, usersBase]);

  const children = useMemo(() => me?.children ?? [], [me]);

  async function saveChild(childId: string) {
    if (!token) return;
    try {
      setSavingId(childId);
      setErr(null);

      const payload = {
        name: edit[childId]?.name ?? "",
        class: edit[childId]?.class ?? "",
        // alergii: acceptăm fie listă (split după virgulă) fie text
        allergies: (edit[childId]?.allergiesText ?? "")
          .split(",")
          .map(s => s.trim())
          .filter(Boolean),
      };

      const updated = await apiPatch<Child>(`${usersBase}/users/children/${childId}`, token, payload);

      // update local state
      setMe((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          children: prev.children.map((c) => (c.id === childId ? { ...c, ...updated } : c)),
        };
      });
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save");
    } finally {
      setSavingId(null);
    }
  }

  if (!authenticated) return <div style={{ padding: 24 }}>Please login.</div>;

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link to="/">← Back</Link>
        <h2 style={{ margin: 0 }}>Profil</h2>
        <div />
      </div>

      {err && (
        <div style={{ background: "#ffe6e6", padding: 12, marginTop: 12, borderRadius: 10 }}>
          {err}
        </div>
      )}

      <div style={{ marginTop: 16, border: "1px solid #ddd", borderRadius: 14, padding: 16 }}>
        <div style={{ fontSize: 14, opacity: 0.7 }}>Bună,</div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>
          {me?.user?.email ?? "User"}
        </div>
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
          Rol: <b>{me?.user?.role ?? "—"}</b> • Copii: <b>{children.length}</b>
        </div>
      </div>

      <h3 style={{ marginTop: 18 }}>Copiii mei</h3>

      {children.length === 0 ? (
        <div style={{ opacity: 0.7 }}>Nu ai copii atașați încă.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {children.map((c) => (
            <div key={c.id} style={{ border: "1px solid #ddd", borderRadius: 14, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{c.name}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>ID: {c.id.slice(0, 6)}…</div>
              </div>

              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, opacity: 0.8 }}>Nume</span>
                  <input
                    value={edit[c.id]?.name ?? ""}
                    onChange={(e) => setEdit((p) => ({ ...p, [c.id]: { ...p[c.id], name: e.target.value } }))}
                    style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                  />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, opacity: 0.8 }}>Clasă</span>
                  <input
                    value={edit[c.id]?.class ?? ""}
                    onChange={(e) => setEdit((p) => ({ ...p, [c.id]: { ...p[c.id], class: e.target.value } }))}
                    style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                  />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, opacity: 0.8 }}>Alergeni (separați prin virgulă)</span>
                  <input
                    placeholder="ex: gluten, lactoză, arahide"
                    value={edit[c.id]?.allergiesText ?? ""}
                    onChange={(e) =>
                      setEdit((p) => ({ ...p, [c.id]: { ...p[c.id], allergiesText: e.target.value } }))
                    }
                    style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                  />
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    Salvat în DB: <b>{prettyAllergies(c.allergies)}</b>
                  </div>
                </label>

                <button
                  onClick={() => saveChild(c.id)}
                  disabled={savingId === c.id}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #333",
                    background: savingId === c.id ? "#eee" : "#fff",
                    cursor: savingId === c.id ? "default" : "pointer",
                    fontWeight: 700,
                  }}
                >
                  {savingId === c.id ? "Se salvează..." : "Salvează"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
