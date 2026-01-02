import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { apiGet, apiPost } from "../api/http";

type Child = { id: string; name: string; class: string };
type MeResponse = { children: Child[] };

type MenuOption = {
  id: string;
  category: "SOUP" | "MAIN" | "DESSERT" | "RESERVE";
  name: string;
  isDefault: boolean;
};

type DailyMenu = {
  id: string;
  date: string;
  title: string;
  options: MenuOption[];
};

export function MenuForDate() {
  const { date } = useParams();
  const nav = useNavigate();
  const { token, authenticated } = useAuth();

  const usersBase = import.meta.env.VITE_USERS_BASE;
  const menusBase = import.meta.env.VITE_MENUS_BASE;
  const ordersBase = import.meta.env.VITE_ORDERS_BASE;

  const [children, setChildren] = useState<Child[]>([]);
  const [childId, setChildId] = useState<string>("");
  const [menu, setMenu] = useState<DailyMenu | null>(null);
  const [picked, setPicked] = useState<Record<string, string>>({}); // category -> optionId
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!authenticated || !token || !date) return;
    (async () => {
      try {
        setErr(null);
        setOkMsg(null);

        const me = await apiGet<MeResponse>(`${usersBase}/users/me`, token);
        setChildren(me.children ?? []);
        if ((me.children ?? []).length > 0) setChildId(me.children[0].id);

        const m = await apiGet<DailyMenu>(`${menusBase}/menus/daily?date=${date}`, token);
        setMenu(m);

        // preselect defaults
        const defaults: Record<string, string> = {};
        for (const opt of m.options ?? []) {
          if (opt.isDefault) defaults[opt.category] = opt.id;
        }
        setPicked(defaults);
      } catch (e: any) {
        setErr(e?.message ?? "Failed");
      }
    })();
  }, [authenticated, token, date, usersBase, menusBase]);

  const grouped = useMemo(() => {
    const g: Record<string, MenuOption[]> = {};
    for (const opt of menu?.options ?? []) {
      g[opt.category] ??= [];
      g[opt.category].push(opt);
    }
    return g;
  }, [menu]);

  async function submit() {
    if (!token || !date) return;
    try {
      setErr(null);
      setOkMsg(null);

      if (!childId) throw new Error("Alege un copil.");
      if (!picked.SOUP || !picked.MAIN || !picked.DESSERT) {
        throw new Error("Trebuie să alegi SOUP, MAIN și DESSERT (sau adaptezi regula).");
      }

      const body = {
        childId,
        orderDate: date,
        dailyMenuId: menu!.id,
        selections: [
            { category: "SOUP", optionId: picked.SOUP },
            { category: "MAIN", optionId: picked.MAIN },
            { category: "DESSERT", optionId: picked.DESSERT },
            ...(picked.RESERVE ? [{ category: "RESERVE", optionId: picked.RESERVE }] : []),
        ],
        };

      await apiPost(`${ordersBase}/orders`, token, body);
      setOkMsg("Comanda a fost plasată.");
      // întoarce-te la dashboard
      setTimeout(() => nav("/"), 500);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to place order");
    }
  }

  if (!authenticated) return <div style={{ padding: 24 }}>Please login.</div>;

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <Link to="/">← Back</Link>
      <h2>Meniul pentru {date}</h2>

      {err && <div style={{ background: "#ffe6e6", padding: 12, marginBottom: 12 }}>{err}</div>}
      {okMsg && <div style={{ background: "#e6ffef", padding: 12, marginBottom: 12 }}>{okMsg}</div>}

      {!menu ? (
        <div>Loading menu…</div>
      ) : (
        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
          <div style={{ marginBottom: 8 }}><b>{menu.title}</b></div>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 16 }}>menuId: {menu.id}</div>

          <div style={{ marginBottom: 12 }}>
            <label>
              Copil:
              <select value={childId} onChange={(e) => setChildId(e.target.value)} style={{ marginLeft: 8 }}>
                {children.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.class})
                  </option>
                ))}
              </select>
            </label>
          </div>

          {(["SOUP", "MAIN", "DESSERT", "RESERVE"] as const).map((cat) => (
            grouped[cat]?.length ? (
              <div key={cat} style={{ marginBottom: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{cat}</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {grouped[cat].map((opt) => (
                    <label key={opt.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="radio"
                        name={cat}
                        checked={picked[cat] === opt.id}
                        onChange={() => setPicked((p) => ({ ...p, [cat]: opt.id }))}
                      />
                      <span>
                        {opt.name} {opt.isDefault ? <span style={{ fontSize: 12, opacity: 0.7 }}>(default)</span> : null}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null
          ))}

          <button onClick={submit}>Submit order</button>
        </div>
      )}
    </div>
  );
}
