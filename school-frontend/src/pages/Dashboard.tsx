// src/pages/Dashboard.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "../auth/AuthProvider";
import { apiGet, apiDelete } from "../api/http";
import { QuickOrderPanel } from "../components/orders/QuickOrderPanel";
import { SelectedDayOrdersPanel } from "../components/orders/SelectedDayOrderPanel";
// import { MyOrdersPanel } from "../components/orders/MyOrdersPanel";

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

    if (!confirm(`Sigur vrei să anulezi comanda din ${ymd(order.orderDate)}?`))
      return;

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

  if (!authenticated)
    return <div style={{ padding: 24 }}>Please login first.</div>;

  // layout: fără scroll pe pagină; scroll doar în panouri

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
          <div
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {err}
          </div>
          <button
            onClick={() => setErr(null)}
            style={{ padding: "6px 10px", borderRadius: 10 }}
          >
            OK
          </button>
        </div>
      )}

      {/* Grid */}
      <div
        style={{
          flex: "auto auto",
          // minHeight: 0,
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          alignItems: "stretch",
        }}
      >
          {/* <MyOrdersPanel
            orders={ordersSorted}
            childMap={childMap}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            onCancelOrder={cancelOrder}
            cancelingId={cancelingId}
          /> */}


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
