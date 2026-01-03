import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { apiGet, apiPost } from "../api/http";

type Child = { id: string; name: string; class: string; allergies?: any };
type MeResponse = { user: any; children: Child[] };

type Order = {
  id: string;
  childId: string;
  orderDate: string; // ISO string
  status: "PENDING" | "CONFIRMED" | "CANCELED";
  selection?: { choices: any; snapshot?: any };
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toYMD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// Monday-first index: Mon=0..Sun=6
function mondayFirstIndex(jsDay: number) {
  // JS: Sun=0..Sat=6
  return (jsDay + 6) % 7;
}

export function OrdersCalendar() {
  const { token, authenticated } = useAuth();
  const usersBase = import.meta.env.VITE_USERS_BASE;
  const ordersBase = import.meta.env.VITE_ORDERS_BASE;

  const [me, setMe] = useState<MeResponse | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // calendar month state
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const monthLabel = useMemo(() => {
    return cursor.toLocaleString(undefined, { month: "long", year: "numeric" });
  }, [cursor]);

  const range = useMemo(() => {
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0); // last day
    return { start, end };
  }, [cursor]);

  const childMap = useMemo(() => {
    const map = new Map<string, Child>();
    for (const c of me?.children ?? []) map.set(c.id, c);
    return map;
  }, [me]);

  // Build map: date(YYYY-MM-DD) -> orders[]
  const ordersByDay = useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const o of orders) {
      const ymd = o.orderDate.slice(0, 10);
      const list = map.get(ymd) ?? [];
      list.push(o);
      map.set(ymd, list);
    }
    return map;
  }, [orders]);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Bulk UI state
  const [bulkChildId, setBulkChildId] = useState<string>("");
  const [bulkOverwrite, setBulkOverwrite] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);

  function prevMonth() {
    setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function nextMonth() {
    setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  async function reloadMonth() {
    if (!token) return;
    const from = toYMD(range.start);
    const to = toYMD(range.end);
    const ord = await apiGet<Order[]>(
      `${ordersBase}/orders?from=${from}&to=${to}`,
      token
    );
    setOrders(ord);
  }

  async function bulkFillMonth() {
    if (!token) return;
    try {
      setBulkMsg(null);
      setErr(null);
      setBulkLoading(true);

      if (!bulkChildId) throw new Error("Selectează copilul.");

      const from = toYMD(range.start);
      const to = toYMD(range.end);

      // 1 request => backend generează toate zilele
      await apiPost<{ ok: boolean; count: number }>(
        `${ordersBase}/orders/monthly-defaults`,
        token,
        { childId: bulkChildId, from, to }
      );

      setBulkMsg(`✅ Generate OK`);
      await reloadMonth();
    } catch (e: any) {
      setErr(e?.message ?? "Bulk failed");
    } finally {
      setBulkLoading(false);
    }
  }

  useEffect(() => {
    if (!authenticated || !token) return;

    (async () => {
      try {
        setErr(null);
        setBulkMsg(null);
        setSelectedDay(null);

        // load me
        const meRes = await apiGet<MeResponse>(`${usersBase}/users/me`, token);
        setMe(meRes);

        // set default child for bulk
        if (!bulkChildId && (meRes.children?.length ?? 0) > 0) {
          setBulkChildId(meRes.children[0].id);
        }

        // load orders for month (1 request)
        const from = toYMD(range.start);
        const to = toYMD(range.end);
        const ord = await apiGet<Order[]>(
          `${ordersBase}/orders?from=${from}&to=${to}`,
          token
        );
        setOrders(ord);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load calendar");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, token, usersBase, ordersBase, range.start, range.end]);

  const weeks = useMemo(() => {
    // create cells from first day aligned to Monday grid, to last day aligned.
    const start = new Date(range.start);
    const end = new Date(range.end);

    const startOffset = mondayFirstIndex(start.getDay()); // 0..6
    const gridStart = new Date(start);
    gridStart.setDate(start.getDate() - startOffset);

    const endOffset = 6 - mondayFirstIndex(end.getDay());
    const gridEnd = new Date(end);
    gridEnd.setDate(end.getDate() + endOffset);

    const days: Date[] = [];
    for (
      let d = new Date(gridStart);
      d <= gridEnd;
      d.setDate(d.getDate() + 1)
    ) {
      days.push(new Date(d));
    }

    const chunks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) chunks.push(days.slice(i, i + 7));
    return chunks;
  }, [range]);

  function dayBadge(ymd: string) {
    const list = ordersByDay.get(ymd) ?? [];
    if (!list.length) return null;

    const hasConfirmed = list.some((o) => o.status === "CONFIRMED");
    const hasPending = list.some((o) => o.status === "PENDING");
    const hasCanceled = list.some((o) => o.status === "CANCELED");

    if (hasConfirmed) return { text: "CONFIRMED", tone: "ok" as const };
    if (hasPending) return { text: "PENDING", tone: "warn" as const };
    if (hasCanceled) return { text: "CANCELED", tone: "bad" as const };
    return { text: "ORDER", tone: "ok" as const };
  }

  function cellStyle(ymd: string) {
    const badge = dayBadge(ymd);
    if (!badge) return { background: "#fff", border: "1px solid #eee" };

    if (badge.tone === "ok")
      return { background: "#e6ffef", border: "1px solid #b7f0c7" };
    if (badge.tone === "warn")
      return { background: "#fff7e6", border: "1px solid #ffe2a8" };
    return { background: "#ffe6e6", border: "1px solid #ffb6b6" };
  }

  if (!authenticated) return <div style={{ padding: 24 }}>Please login.</div>;

  const selectedOrders = selectedDay
    ? ordersByDay.get(selectedDay) ?? []
    : [];

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h2>Calendar comenzi</h2>

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

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <button onClick={prevMonth}>←</button>
        <div style={{ fontWeight: 700 }}>{monthLabel}</div>
        <button onClick={nextMonth}>→</button>

        {/* Bulk controls */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginLeft: 12,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 12, opacity: 0.8 }}>Copil:</span>
          <select
            value={bulkChildId}
            onChange={(e) => setBulkChildId(e.target.value)}
            style={{
              padding: "6px 8px",
              borderRadius: 8,
              border: "1px solid #ddd",
            }}
          >
            {(me?.children ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.class})
              </option>
            ))}
          </select>

          <label
            style={{
              fontSize: 12,
              opacity: 0.85,
              display: "flex",
              gap: 6,
              alignItems: "center",
            }}
          >
            <input
              type="checkbox"
              checked={bulkOverwrite}
              onChange={(e) => setBulkOverwrite(e.target.checked)}
            />
            overwrite
          </label>

          <button onClick={bulkFillMonth} disabled={bulkLoading || !bulkChildId}>
            {bulkLoading ? "Generating..." : "Generează default (luna asta)"}
          </button>
        </div>

        <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.7 }}>
          Zile cu comandă: {ordersByDay.size}
        </div>

        {bulkMsg ? (
          <div
            style={{
              width: "100%",
              marginTop: 8,
              background: "#e6ffef",
              padding: 10,
              borderRadius: 10,
              fontSize: 12,
            }}
          >
            {bulkMsg}
          </div>
        ) : null}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
        {/* Calendar */}
        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 8,
              marginBottom: 8,
            }}
          >
            {["L", "Ma", "Mi", "J", "V", "S", "D"].map((d) => (
              <div
                key={d}
                style={{ fontSize: 12, opacity: 0.7, textAlign: "center" }}
              >
                {d}
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {weeks.map((w, idx) => (
              <div
                key={idx}
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  gap: 8,
                }}
              >
                {w.map((day) => {
                  const ymd = toYMD(day);
                  const inMonth = day.getMonth() === cursor.getMonth();
                  const badge = dayBadge(ymd);
                  const selected = selectedDay === ymd;

                  return (
                    <button
                      key={ymd}
                      onClick={() => setSelectedDay(ymd)}
                      style={{
                        textAlign: "left",
                        padding: 10,
                        borderRadius: 10,
                        cursor: "pointer",
                        opacity: inMonth ? 1 : 0.35,
                        outline: selected ? "2px solid #111" : "none",
                        ...cellStyle(ymd),
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>{day.getDate()}</div>
                        {badge ? (
                          <span style={{ fontSize: 10, opacity: 0.8 }}>
                            {badge.text}
                          </span>
                        ) : (
                          <span style={{ fontSize: 10, opacity: 0.3 }}>—</span>
                        )}
                      </div>

                      {badge ? (
                        <div style={{ marginTop: 6, fontSize: 11, opacity: 0.8 }}>
                          {(ordersByDay.get(ymd) ?? []).length} comenzi
                        </div>
                      ) : (
                        <div style={{ marginTop: 6, fontSize: 11, opacity: 0.5 }}>
                          fără comandă
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Side panel */}
        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            {selectedDay ? `Detalii ${selectedDay}` : "Selectează o zi"}
          </div>

          {!selectedDay ? (
            <div style={{ opacity: 0.7, fontSize: 12 }}>
              Click pe o zi ca să vezi ce au comandat copiii.
            </div>
          ) : selectedOrders.length === 0 ? (
            <div style={{ opacity: 0.7, fontSize: 12 }}>
              Nu există comenzi în ziua asta.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {selectedOrders.map((o) => {
                const child = childMap.get(o.childId);
                return (
                  <div
                    key={o.id}
                    style={{ border: "1px solid #eee", borderRadius: 10, padding: 10 }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div style={{ fontWeight: 700 }}>
                        {child ? `${child.name} (${child.class})` : `childId: ${o.childId}`}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>{o.status}</div>
                    </div>

                    {o.selection?.snapshot ? (
                      <pre
                        style={{
                          marginTop: 8,
                          marginBottom: 0,
                          fontSize: 11,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {JSON.stringify(o.selection.snapshot, null, 2)}
                      </pre>
                    ) : (
                      <div style={{ marginTop: 8, fontSize: 11, opacity: 0.7 }}>
                        (nu există snapshot)
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
            Tip: pentru “31 zile default”, UI-ul ăsta e perfect: vezi instant ce zile lipsesc.
          </div>
        </div>
      </div>
    </div>
  );
}
