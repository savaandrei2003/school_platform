import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { apiGet, apiDelete } from "../api/http";
import { TodayOrdersCard } from "../components/orders/TodayOrdersCars";
import { QuickOrderPanel } from "../components/orders/QuickOrderPanel";

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

function ymd(s: string) {
  return s?.slice(0, 10);
}

function statusPill(status: string) {
  const base: React.CSSProperties = {
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
    border: "1px solid rgba(0,0,0,0.08)",
    fontWeight: 700,
  };

  if (status === "CONFIRMED") return { ...base, background: "#e6ffef" };
  if (status === "PENDING") return { ...base, background: "#fff7e6" };
  if (status === "CANCELED") return { ...base, background: "#ffe6e6" };
  return { ...base, background: "#f2f2f2" };
}

export function Dashboard() {
  const { token, authenticated } = useAuth();

  const usersBase = import.meta.env.VITE_USERS_BASE;
  const ordersBase = import.meta.env.VITE_ORDERS_BASE;

  const [me, setMe] = useState<MeResponse | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [todayOrders, setTodayOrders] = useState<Order[]>([]);
  const [date, setDate] = useState(() => todayISODate());
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // UI state for cancel
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }, [token, usersBase, ordersBase]);

  useEffect(() => {
    if (!authenticated || !token) return;
    reload();
  }, [authenticated, token, reload]);

  const childMap = useMemo(() => {
    const map = new Map<string, Child>();
    for (const c of me?.children ?? []) map.set(c.id, c);
    return map;
  }, [me]);

  const ordersSorted = useMemo(() => {
    return [...orders].sort((a, b) => a.orderDate.localeCompare(b.orderDate));
  }, [orders]);

  async function cancelOrder(order: Order) {
    if (!token) return;

    if (order.status !== "PENDING") return;
    if (!confirm(`Sigur vrei să anulezi comanda din ${ymd(order.orderDate)}?`))
      return;

    try {
      setErr(null);
      setCancelingId(order.id);

      await apiDelete(`${ordersBase}/orders/${order.id}`, token);

      await reload();
    } catch (e: any) {
      // backend poate refuza după 09:00 -> mesaj aici
      setErr(e?.message ?? "Cancel failed");
    } finally {
      setCancelingId(null);
    }
  }

  if (!authenticated)
    return <div style={{ padding: 24 }}>Please login first.</div>;

  return (
    <div
      style={{
      height: "100%",        // nu 100vh aici
      width: "100%",
      padding: 16,
      boxSizing: "border-box",
      overflow: "hidden",    // fără scroll la nivelul dashboardului
    }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <h2 style={{ margin: 0 }}>Dashboard</h2>
        {loading ? (
          <span style={{ fontSize: 12, opacity: 0.6 }}>Loading…</span>
        ) : null}
        <div style={{ marginLeft: "auto" }}>
          <button
            onClick={reload}
            style={{ padding: "8px 10px", borderRadius: 10 }}
          >
            Refresh
          </button>
        </div>
      </div>

      {err && (
        <div
          style={{
            background: "#ffe6e6",
            padding: 12,
            marginBottom: 12,
            borderRadius: 10,
          }}
        >
          {err}
        </div>
      )}

      {/* Main grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "500px 1fr 300px", // stânga fix, mijloc elastic, dreapta fix
          gap: 16,
          alignItems: "start",
          height: "calc(100vh - 90px)", // ~header + padding (ajustează 90 dacă vrei)
        }}
      >
        {/* LEFT: Comenzile mele - full height */}
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 16,
            height: "80%",
            overflow: "hidden", // ca scroll-ul să fie doar în listă
            background: "#fff",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 10,
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 6 }}>Comenzile mele</h3>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Total: <b>{ordersSorted.length}</b>
            </div>
          </div>

          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>
            Comenzi pentru azi + viitor (scroll).
          </div>

          {/* LISTA SCROLL */}
          <div
            style={{
              height: "calc(100% - 70px)",
              overflow: "auto",
              paddingRight: 6,
            }}
          >
            {ordersSorted.length === 0 ? (
              <div style={{ opacity: 0.7 }}>Nu ai comenzi încă.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {ordersSorted.map((o) => {
                  const child = childMap.get(o.childId);
                  const snap = o.selection?.snapshot ?? [];
                  const pick = (cat: string) =>
                    snap.find((x) => x.category === cat)?.optionName ?? "—";

                  const canCancel = o.status === "PENDING";
                  const isBusy = cancelingId === o.id;

                  return (
                    <div
                      key={o.id}
                      style={{
                        border: "1px solid #eee",
                        borderRadius: 12,
                        padding: 12,
                        background: "#fff",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 900 }}>
                            {child?.name ?? "Copil"}{" "}
                            <span style={{ fontSize: 12, opacity: 0.7 }}>
                              ({child?.class ?? "?"})
                            </span>
                          </div>

                          <div
                            style={{
                              marginTop: 4,
                              fontSize: 12,
                              opacity: 0.85,
                            }}
                          >
                            <b>{ymd(o.orderDate)}</b> •{" "}
                            <span style={statusPill(o.status)}>{o.status}</span>
                          </div>
                        </div>

                        <button
                          onClick={() => cancelOrder(o)}
                          disabled={!canCancel || isBusy}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 10,
                            border: "1px solid #ddd",
                            background: "#fff",
                            cursor:
                              canCancel && !isBusy ? "pointer" : "not-allowed",
                            opacity: canCancel && !isBusy ? 1 : 0.5,
                            height: 36,
                          }}
                        >
                          {isBusy ? "Canceling…" : "Cancel"}
                        </button>
                      </div>

                      <div
                        style={{
                          marginTop: 10,
                          fontSize: 13,
                          lineHeight: 1.55,
                        }}
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
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div style={{ height: "100%", overflow: "hidden" }}>
          <div style={{ height: "100%", overflow: "auto" }}>

            <QuickOrderPanel
              token={token!}
              ordersBase={ordersBase}
              children={me?.children ?? []}
              orders={ordersSorted}
            />

          </div>
        </div>

        {/* RIGHT: Mâncarea de azi - half height */}
        <div
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 12,
              padding: 16,
              background: "#fff",
              height: "70%", // jumătate ecran
              // overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: 6 }}>Mâncare de azi</h3>
              <div style={{ fontSize: 12, opacity: 0.7 }}>{todayISODate()}</div>
            </div>

            {/* scroll doar în content */}
            <div
              style={{
                height: "100%",
                overflow: "auto",
                paddingRight: 6,
              }}
            >
              <TodayOrdersCard
                todayOrders={todayOrders}
                children={me?.children ?? []}
                token={token!}
                ordersBase={ordersBase}
                reload={reload}
              />
            </div>
          </div>

          {/* restul spațiului din dreapta rămâne liber (focus pe calendar + orders) */}
          <div style={{ flex: 1 }} />
        </div>
      </div>
    </div>
  );
}
