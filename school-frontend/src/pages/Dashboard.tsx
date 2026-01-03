import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { apiGet } from "../api/http";
import { Link } from "react-router-dom";

type Child = { id: string; name: string; class: string };
type MeResponse = { user: any; children: Child[]; message?: string };

type SnapshotItem = { category: string; optionId: string; optionName: string };

type Order = {
  id: string;
  childId: string;
  orderDate: string;
  status: string;
  selection?: { choices: any; snapshot?: SnapshotItem[] };
};

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

export function Dashboard() {
  const { token, authenticated } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [todayOrders, setTodayOrders] = useState<Order[]>([]);
  const [date, setDate] = useState(() => todayISODate());
  const [err, setErr] = useState<string | null>(null);

  const usersBase = import.meta.env.VITE_USERS_BASE;
  const ordersBase = import.meta.env.VITE_ORDERS_BASE;

  useEffect(() => {
    if (!authenticated || !token) return;

    (async () => {
      try {
        setErr(null);

        const meRes = await apiGet<MeResponse>(`${usersBase}/users/me`, token);
        setMe(meRes);

        const ordRes = await apiGet<Order[]>(`${ordersBase}/orders`, token);
        setOrders(ordRes);

        const todayRes = await apiGet<Order[]>(
          `${ordersBase}/orders/today`,
          token
        );
        setTodayOrders(todayRes);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load");
      }
    })();
  }, [authenticated, token, usersBase, ordersBase]);

  const ordersSorted = useMemo(() => {
    return [...orders].sort((a, b) => a.orderDate.localeCompare(b.orderDate));
  }, [orders]);

  const childMap = useMemo(() => {
    const map = new Map<string, Child>();
    for (const c of me?.children ?? []) map.set(c.id, c);
    return map;
  }, [me]);

  const todayCards = useMemo(() => {
    // grupăm pe copil (în caz că în viitor ai mai multe comenzi/zi)
    const byChild = new Map<string, Order[]>();
    for (const o of todayOrders ?? []) {
      byChild.set(o.childId, [...(byChild.get(o.childId) ?? []), o]);
    }
    return [...byChild.entries()];
  }, [todayOrders]);

  if (!authenticated) {
    return <div style={{ padding: 24 }}>Please login first.</div>;
  }

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h2>Dashboard</h2>

      {err && (
        <div style={{ background: "#ffe6e6", padding: 12, marginBottom: 12 }}>
          {err}
        </div>
      )}

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}
      >
        {/* 1) Comenzile mele */}
        <div
          style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}
        >
          <h3>Comenzile mele</h3>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
            Copii: {me?.children?.length ?? 0}
          </div>

          {ordersSorted.length === 0 ? (
            <div style={{ opacity: 0.7 }}>Nu ai comenzi încă.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {ordersSorted.map((o) => (
                <div
                  key={o.id}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <div>
                    <b>{o.orderDate.slice(0, 10)}</b> — {o.status}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    Copil: {childMap.get(o.childId)?.name ?? "—"} (
                    {childMap.get(o.childId)?.class ?? "?"})
                  </div>
                  {o.selection?.snapshot?.length ? (
                    <div style={{ fontSize: 12, marginTop: 6 }}>
                      <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                        {JSON.stringify(o.selection.snapshot, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2) Plasează comandă */}
        <div
          style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}
        >
          <h3>Plasează comandă</h3>

          <label style={{ display: "block", marginBottom: 8 }}>
            Data:
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ marginLeft: 8 }}
            />
          </label>

          <Link to={`/menus/${date}`}>
            <button>Continuă → selectează meniul pentru {date}</button>
          </Link>

          <Link to="/profile">
            <button style={{ marginLeft: 12 }}>Profil</button>
          </Link>

          <Link to="/calendar">
            <button style={{ marginLeft: 12 }}>Calendar</button>
          </Link>

          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>
            Vei alege copil + opțiuni (SOUP/MAIN/DESSERT) pe pagina următoare.
          </div>
        </div>

        {/* 3) Mâncarea de azi */}
        <div
          style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}
        >
          <h3>Mâncarea de azi</h3>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 10 }}>
            {todayISODate()}
          </div>

          {todayOrders.length === 0 ? (
            <div style={{ opacity: 0.7 }}>Nu există comenzi pentru azi.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {todayCards.map(([childId, list]) => {
                const child = childMap.get(childId);
                const order = list[0]; // 1/zi în modelul tău
                const snap = order.selection?.snapshot ?? [];

                // helper: găsește numele pe categorie
                const pick = (cat: string) =>
                  snap.find((x) => x.category === cat)?.optionName ?? "—";

                return (
                  <div
                    key={childId}
                    style={{
                      border: "1px solid #eee",
                      borderRadius: 10,
                      padding: 12,
                    }}
                  >
                    <div style={{ fontWeight: 800 }}>
                      {child?.name ?? "Copil"}{" "}
                      <span style={{ fontSize: 12, opacity: 0.7 }}>
                        ({child?.class ?? "?"})
                      </span>
                    </div>

                    {snap.length ? (
                      <div
                        style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5 }}
                      >
                        <div>
                          <b>SOUP:</b> {pick("SOUP")}
                        </div>
                        <div>
                          <b>MAIN:</b> {pick("MAIN")}
                        </div>
                        <div>
                          <b>DESSERT:</b> {pick("DESSERT")}
                        </div>
                        {snap.some((x) => x.category === "RESERVE") ? (
                          <div>
                            <b>RESERVE:</b> {pick("RESERVE")}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
                        Nu am snapshot (poți afișa choices brute).
                      </div>
                    )}

                    <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
                      status: <b>{order.status}</b>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
