import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { apiGet } from "../api/http";
import { Link } from "react-router-dom";

type Child = { id: string; name: string; class: string };
type MeResponse = { user: any; children: Child[]; message?: string };

type Order = {
  id: string;
  childId: string;
  orderDate: string;
  status: string;
  selection?: { choices: any; snapshot?: any };
};

export function Dashboard() {
  const { token, authenticated } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
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
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load");
      }
    })();
  }, [authenticated, token, usersBase, ordersBase]);

  const ordersSorted = useMemo(() => {
    return [...orders].sort((a, b) => a.orderDate.localeCompare(b.orderDate));
  }, [orders]);

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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
          <h3>Comenzile mele</h3>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
            Copii: {me?.children?.length ?? 0}
          </div>

          {ordersSorted.length === 0 ? (
            <div style={{ opacity: 0.7 }}>Nu ai comenzi încă.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {ordersSorted.map((o) => (
                <div key={o.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
                  <div><b>{o.orderDate.slice(0, 10)}</b> — {o.status}</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>childId: {o.childId}</div>
                  {o.selection?.snapshot ? (
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

        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
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

          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>
            Vei alege copil + opțiuni (SOUP/MAIN/DESSERT) pe pagina următoare.
          </div>
        </div>
      </div>
    </div>
  );
}
