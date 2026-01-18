import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { apiGet, apiPost, apiDelete } from "../api/http";

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

type SnapshotItem = { category: string; optionId: string; optionName: string };
type Order = {
  id: string;
  childId: string;
  orderDate: string;
  status: "PENDING" | "CONFIRMED" | "CANCELED" | string;
  selection?: { choices: any; snapshot?: SnapshotItem[] };
};

const card: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 14,
  padding: 16,
  background: "#fff",
};

const pill = (bg: string): React.CSSProperties => ({
  display: "inline-block",
  padding: "4px 8px",
  borderRadius: 999,
  fontSize: 12,
  background: bg,
  border: "1px solid rgba(0,0,0,0.08)",
});

function ymd(d: string) {
  return d?.slice(0, 10);
}

export function MenuForDate() {
  const { date } = useParams();
  const nav = useNavigate();
  const { token, authenticated } = useAuth();

  const [searchParams, setSearchParams] = useSearchParams();
  const childIdFromQuery = searchParams.get("childId") ?? "";

  const usersBase = import.meta.env.VITE_USERS_BASE;
  const menusBase = import.meta.env.VITE_MENUS_BASE;
  const ordersBase = import.meta.env.VITE_ORDERS_BASE;

  const [children, setChildren] = useState<Child[]>([]);
  const [childId, setChildId] = useState<string>("");

  const [menu, setMenu] = useState<DailyMenu | null>(null);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [existingOrder, setExistingOrder] = useState<Order | null>(null);

  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load children + menu
  useEffect(() => {
    if (!authenticated || !token || !date) return;

    (async () => {
      try {
        setLoading(true);
        setErr(null);
        setOkMsg(null);

        const me = await apiGet<MeResponse>(`${usersBase}/users/me`, token);
        const kids = me.children ?? [];
        setChildren(kids);

        const initial =
          kids.some((c) => c.id === childIdFromQuery)
            ? childIdFromQuery
            : kids[0]?.id ?? "";

        setChildId(initial);

        // ensure URL reflects chosen child (optional, but nice)
        if (initial && initial !== childIdFromQuery) {
          setSearchParams({ childId: initial });
        }

        const m = await apiGet<DailyMenu>(`${menusBase}/daily?date=${date}`, token);
        setMenu(m);

        // preselect defaults
        const defaults: Record<string, string> = {};
        for (const opt of m.options ?? []) {
          if (opt.isDefault) defaults[opt.category] = opt.id;
        }
        setPicked(defaults);
      } catch (e: any) {
        setErr(e?.message ?? "Failed");
      } finally {
        setLoading(false);
      }
    })();
  }, [authenticated, token, date, usersBase, menusBase, childIdFromQuery, setSearchParams]);

  // Group options by category for UI
  const grouped = useMemo(() => {
    const g: Record<string, MenuOption[]> = {};
    for (const opt of menu?.options ?? []) {
      g[opt.category] ??= [];
      g[opt.category].push(opt);
    }
    return g;
  }, [menu]);

  const selectedPreview = useMemo(() => {
    if (!menu) return [];
    const byId = new Map(menu.options.map((o) => [o.id, o]));
    const cats: Array<MenuOption["category"]> = ["SOUP", "MAIN", "DESSERT", "RESERVE"];
    return cats
      .filter((c) => picked[c])
      .map((c) => ({
        category: c,
        option: byId.get(picked[c])?.name ?? "—",
      }));
  }, [menu, picked]);

  // Load existing order for (childId, date)
  const loadExistingOrder = useCallback(async () => {
    if (!token || !date || !childId) return;
    try {
      setErr(null);

      const ord = await apiGet<Order[]>(`${ordersBase}/orders?from=${date}&to=${date}`, token);

      const found = (ord ?? []).find((o) => ymd(o.orderDate) === date && o.childId === childId);
      setExistingOrder(found ?? null);
    } catch {
      setExistingOrder(null);
    }
  }, [token, date, childId, ordersBase]);

  useEffect(() => {
    if (!authenticated || !token || !date || !childId) return;
    loadExistingOrder();
  }, [authenticated, token, date, childId, loadExistingOrder]);

  async function submit() {
    if (!token || !date || !menu) return;
    try {
      setErr(null);
      setOkMsg(null);

      if (!childId) throw new Error("Alege un copil.");
      if (!picked.SOUP || !picked.MAIN || !picked.DESSERT) {
        throw new Error("Trebuie să alegi SOUP, MAIN și DESSERT.");
      }

      const body = {
        childId,
        orderDate: date,
        dailyMenuId: menu.id,
        selections: [
          { category: "SOUP", optionId: picked.SOUP },
          { category: "MAIN", optionId: picked.MAIN },
          { category: "DESSERT", optionId: picked.DESSERT },
          ...(picked.RESERVE ? [{ category: "RESERVE", optionId: picked.RESERVE }] : []),
        ],
      };

      await apiPost(`${ordersBase}/orders`, token, body);

      setOkMsg(existingOrder ? "Comanda a fost actualizată ✅" : "Comanda a fost plasată ✅");
      await loadExistingOrder();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to place order");
    }
  }

  async function cancel() {
    if (!token) return;
    if (!existingOrder) return;
    try {
      setErr(null);
      setOkMsg(null);

      if (!confirm("Sigur vrei să anulezi comanda?")) return;

      await apiDelete(`${ordersBase}/orders/${existingOrder.id}`, token);
      setOkMsg("Comanda a fost anulată ✅");
      await loadExistingOrder();
    } catch (e: any) {
      setErr(e?.message ?? "Cancel failed");
    }
  }

  const statusTone =
    existingOrder?.status === "CONFIRMED"
      ? pill("#e6ffef")
      : existingOrder?.status === "PENDING"
      ? pill("#fff7e6")
      : existingOrder?.status === "CANCELED"
      ? pill("#ffe6e6")
      : pill("#f2f2f2");

  const canCancel = !!existingOrder && existingOrder.status === "PENDING";

  if (!authenticated) return <div style={{ padding: 24 }}>Please login.</div>;

  return (
    <div style={{ fontFamily: "system-ui" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <Link to="/" style={{ textDecoration: "none" }}>
          ← Back
        </Link>
        <div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Meniu</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{date}</div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          {loading ? <span style={{ fontSize: 12, opacity: 0.6 }}>Loading…</span> : null}
          <button onClick={() => nav("/calendar")} style={{ padding: "8px 10px", borderRadius: 10 }}>
            Calendar
          </button>
        </div>
      </div>

      {err && (
        <div style={{ background: "#ffe6e6", padding: 12, marginBottom: 12, borderRadius: 10 }}>
          {err}
        </div>
      )}
      {okMsg && (
        <div style={{ background: "#e6ffef", padding: 12, marginBottom: 12, borderRadius: 10 }}>
          {okMsg}
        </div>
      )}

      {!menu ? (
        <div style={card}>Loading menu…</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16 }}>
          {/* Left: Options */}
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>{menu.title}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>menuId: {menu.id}</div>
              </div>

              <div>
                <label style={{ fontSize: 12, opacity: 0.8 }}>
                  Copil
                  <select
                    value={childId}
                    onChange={(e) => {
                      const v = e.target.value;
                      setChildId(v);
                      setSearchParams({ childId: v }); // keep URL in sync
                    }}
                    style={{
                      marginLeft: 8,
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid #ddd",
                    }}
                  >
                    {children.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.class})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {(["SOUP", "MAIN", "DESSERT", "RESERVE"] as const).map((cat) =>
              grouped[cat]?.length ? (
                <div key={cat} style={{ marginTop: 14 }}>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>{cat}</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {grouped[cat].map((opt) => {
                      const active = picked[cat] === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => setPicked((p) => ({ ...p, [cat]: opt.id }))}
                          style={{
                            textAlign: "left",
                            padding: "10px 12px",
                            borderRadius: 12,
                            border: active ? "2px solid #111" : "1px solid #ddd",
                            background: active ? "#f6f6f6" : "#fff",
                            cursor: "pointer",
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                            alignItems: "center",
                          }}
                        >
                          <span style={{ fontWeight: 700 }}>{opt.name}</span>
                          {opt.isDefault ? <span style={pill("#f2f2f2")}>default</span> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null
            )}
          </div>

          {/* Right: Preview + Actions */}
          <div style={{ display: "grid", gap: 16 }}>
            <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div style={{ fontWeight: 900 }}>Comanda (data asta)</div>
                {existingOrder ? (
                  <span style={statusTone}>{existingOrder.status}</span>
                ) : (
                  <span style={pill("#f2f2f2")}>none</span>
                )}
              </div>

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
                {existingOrder ? `orderId: ${existingOrder.id}` : "Nu există comandă încă pentru copilul selectat."}
              </div>

              <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.6 }}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Preview selecție</div>
                {selectedPreview.length ? (
                  <div style={{ display: "grid", gap: 6 }}>
                    {selectedPreview.map((x) => (
                      <div key={x.category}>
                        <b>{x.category}:</b> {x.option}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ opacity: 0.7 }}>Alege opțiunile din stânga.</div>
                )}
              </div>

              <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  onClick={submit}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #111",
                    background: "#111",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  {existingOrder ? "Update order" : "Place order"}
                </button>

                <button
                  onClick={cancel}
                  disabled={!canCancel}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #ddd",
                    background: "#fff",
                    cursor: canCancel ? "pointer" : "not-allowed",
                    opacity: canCancel ? 1 : 0.5,
                  }}
                  title={!canCancel ? "Se poate anula doar dacă e PENDING (și înainte de cutoff)." : "Anulează comanda"}
                >
                  Cancel order
                </button>
              </div>

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                Notă: după 09:00 backend-ul poate refuza anularea. Dacă se întâmplă, vei vedea mesajul aici.
              </div>
            </div>

            <div style={{ ...card, background: "#fafafa" }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Tip</div>
              <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.5 }}>
                Pentru zile viitoare poți modifica/anula comanda până la cutoff. Pentru azi, cel mai des după 09:00 nu se mai poate.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
