// src/pages/Dashboard.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "../auth/AuthProvider";
import { apiGet, apiDelete } from "../api/http";

import {
  OrdersCalendarPanel,
  type HighlightRange,
} from "../components/orders/OrdersCalendarPanel";
import { BulkDefaultsPanel } from "../components/orders/BulkDefaultsPanel";
import { SelectedDayOrdersPanel } from "../components/orders/SelectedDayOrdersPanel";

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

  // ✅ NEW: copil selectat (obligatoriu pt Continue/Update)
  const [selectedChildId, setSelectedChildId] = useState<string>("");

  // preview range (din BulkDefaultsPanel)
  const [highlight, setHighlight] = useState<HighlightRange | null>(null);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setErr(null);

      const meRes = await apiGet<MeResponse>(`${usersBase}/users/me`, token);
      setMe(meRes);

      const ordRes = await apiGet<Order[]>(`${ordersBase}/orders`, token);
      setOrders(ordRes);

      // ✅ auto-select copil dacă nu e setat încă
      const firstChildId = meRes?.children?.[0]?.id ?? "";
      setSelectedChildId((prev) => prev || firstChildId);
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
    // poți să NU filtrezi aici (panelul filtrează), dar e mai curat:
    return (ordersByDay.get(selectedDay) ?? []).filter(
      (o) => o.status !== "CANCELED"
    );
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

      {/* 2 columns: LEFT calendar, RIGHT split */}
      <div
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "minmax(420px, 1fr) minmax(520px, 1fr)",
          gap: 16,
          alignItems: "stretch",
        }}
      >
        {/* LEFT: calendar */}
        <div style={{ minWidth: 0, minHeight: 0, overflow: "hidden" }}>
          <OrdersCalendarPanel
            orders={ordersSorted}
            children={me?.children ?? []}
            selectedDay={selectedDay}
            onSelectDay={(d) => {
              setSelectedDay(d);
              // dacă vrei să “decuplezi” preview range la click:
              // setHighlight(null);
            }}
            selectedChildId={selectedChildId}
            onSelectChildId={setSelectedChildId}
            highlight={highlight}
            loading={loading}
          />
        </div>

        {/* RIGHT: split vertically */}
        <div
          style={{
            minWidth: 0,
            minHeight: 0,
            overflow: "hidden",
            display: "grid",
            gridTemplateRows: "340px minmax(0, 1fr)",
            gap: 16,
          }}
        >
          {/* RIGHT TOP: bulk defaults builder */}
          <div style={{ minWidth: 0, minHeight: 0, overflow: "hidden" }}>
            <BulkDefaultsPanel
              token={token!}
              ordersBase={ordersBase}
              children={me?.children ?? []}
              selectedDay={selectedDay}
              onPreviewRange={setHighlight}
              onDone={reload}
            />
          </div>

          {/* RIGHT BOTTOM: selected-day orders */}
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
    </div>
  );
}
