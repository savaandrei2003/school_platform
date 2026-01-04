// src/pages/Dashboard.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "../auth/AuthProvider";
import { apiGet, apiDelete } from "../api/http";
import { QuickOrderPanel } from "../components/orders/QuickOrderPanel";
import { SelectedDayOrdersPanel } from "../components/orders/SelectedDayOrderPanel";

type Child = { id: string; name: string; class: string };
type MeResponse = { user: any; children: Child[]; message?: string };

type SnapshotItem = { category: string; optionId: string; optionName: string };
export type Order = {
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

export function Dashboard() {
  const { token, authenticated } = useAuth();

  const usersBase = import.meta.env.VITE_USERS_BASE;
  const ordersBase = import.meta.env.VITE_ORDERS_BASE;

  const [me, setMe] = useState<MeResponse | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(() => todayISODate());

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setErr(null);

      const meRes = await apiGet<MeResponse>(`${usersBase}/users/me`, token);
      setMe(meRes);

      const ordRes = await apiGet<Order[]>(`${ordersBase}/orders`, token);
      setOrders(ordRes);
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

  const ordersByDay = useMemo(() => {
    const m = new Map<string, Order[]>();
    for (const o of ordersSorted) {
      const day = ymd(o.orderDate);
      m.set(day, [...(m.get(day) ?? []), o]);
    }
    return m;
  }, [ordersSorted]);

  const selectedOrders = useMemo(() => {
    return ordersByDay.get(selectedDay) ?? [];
  }, [ordersByDay, selectedDay]);

  async function cancelOrder(order: Order) {
    if (!token) return;
    if (order.status !== "PENDING") return;

    if (!confirm(`Sigur vrei să anulezi comanda din ${ymd(order.orderDate)}?`)) return;

    try {
      setErr(null);
      setCancelingId(order.id);
      await apiDelete(`${ordersBase}/orders/${order.id}`, token);
      await reload();
    } catch (e: any) {
      setErr(e?.message ?? "Cancel failed");
    } finally {
      setCancelingId(null);
    }
  }

  if (!authenticated) return <div style={{ padding: 24 }}>Please login first.</div>;

  // layout: fără scroll pe pagină; scroll doar în panouri
  const headerH = 56;
  const errH = err ? 56 : 0;

  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        padding: 16,
        boxSizing: "border-box",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* Header */}
      <div
        style={{
          height: headerH,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flex: "0 0 auto",
          minWidth: 0,
        }}
      >
        <h2 style={{ margin: 0 }}>Dashboard</h2>
        {loading ? <span style={{ fontSize: 12, opacity: 0.6 }}>Loading…</span> : null}

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={reload} style={{ padding: "8px 10px", borderRadius: 10 }}>
            Refresh
          </button>
        </div>
      </div>

      {err && (
        <div
          style={{
            height: errH,
            flex: "0 0 auto",
            background: "#ffe6e6",
            borderRadius: 10,
            padding: "10px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            minWidth: 0,
          }}
        >
          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{err}</div>
          <button onClick={() => setErr(null)} style={{ padding: "6px 10px", borderRadius: 10 }}>
            OK
          </button>
        </div>
      )}

      {/* Grid */}
      <div
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "420px minmax(0, 1fr) 360px",
          gap: 16,
          alignItems: "stretch",
        }}
      >
        {/* LEFT: Comenzile mele */}
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 12,
            background: "#fff",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          <div style={{ padding: 16, borderBottom: "1px solid #eee" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
              <h3 style={{ margin: 0 }}>Comenzile mele</h3>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Total: <b>{ordersSorted.length}</b>
              </div>
            </div>
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
              Click pe o comandă (sau pe zi în calendar) ca să vezi toate comenzile din ziua aia în dreapta.
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 16, paddingRight: 12 }}>
            {ordersSorted.length === 0 ? (
              <div style={{ opacity: 0.7 }}>Nu ai comenzi încă.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {ordersSorted.map((o) => {
                  const child = childMap.get(o.childId);
                  const day = ymd(o.orderDate);
                  const snap = o.selection?.snapshot ?? [];
                  const pick = (cat: string) => snap.find((x) => x.category === cat)?.optionName ?? "—";
                  const canCancel = o.status === "PENDING";
                  const busy = cancelingId === o.id;
                  const selected = day === selectedDay;

                  return (
                    <div
                      key={o.id}
                      onClick={() => setSelectedDay(day)}
                      style={{
                        border: selected ? "2px solid #111" : "1px solid #eee",
                        borderRadius: 12,
                        padding: 12,
                        background: "#fff",
                        cursor: "pointer",
                      }}
                      title="Click pentru detalii în dreapta"
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 900 }}>
                            {child?.name ?? "Copil"}{" "}
                            <span style={{ fontSize: 12, opacity: 0.7 }}>({child?.class ?? "?"})</span>
                          </div>
                          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.85 }}>
                            <b>{day}</b> • <b>{o.status}</b>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelOrder(o);
                          }}
                          disabled={!canCancel || busy}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 10,
                            border: "1px solid #ddd",
                            background: "#fff",
                            cursor: canCancel && !busy ? "pointer" : "not-allowed",
                            opacity: canCancel && !busy ? 1 : 0.5,
                            height: 36,
                            whiteSpace: "nowrap",
                          }}
                          title={!canCancel ? "Poți anula doar PENDING (înainte de cutoff)" : "Anulează"}
                        >
                          {busy ? "Canceling…" : "Cancel"}
                        </button>
                      </div>

                      <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.55 }}>
                        <div>
                          <b>SOUP:</b> {pick("SOUP")}
                        </div>
                        <div>
                          <b>MAIN:</b> {pick("MAIN")}
                        </div>
                        <div>
                          <b>DESSERT:</b> {pick("DESSERT")}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* MIDDLE: Calendar + acțiuni (fără scroll pe pagină; scroll doar aici dacă e nevoie) */}
        <div style={{ minWidth: 0, minHeight: 0, overflow: "hidden" }}>
          <QuickOrderPanel
            token={token!}
            ordersBase={ordersBase}
            children={me?.children ?? []}
            orders={ordersSorted}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            selectedOrders={selectedOrders}
            onCancelOrder={cancelOrder}
            cancelingId={cancelingId}
          />
        </div>

        {/* RIGHT: toate comenzile din ziua selectată */}
        <div style={{ minWidth: 0, minHeight: 0, overflow: "hidden" }}>
          <SelectedDayOrdersPanel
            selectedDay={selectedDay}
            orders={selectedOrders}
            childMap={childMap}
            onCancelOrder={cancelOrder}
            cancelingId={cancelingId}
          />
        </div>
      </div>
    </div>
  );
}
