// src/components/orders/QuickOrderPanel.tsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost } from "../../api/http";
import type { Order } from "../../pages/Dashboard";

type Child = { id: string; name: string; class: string };

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function toYMD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function mondayFirstIndex(jsDay: number) {
  return (jsDay + 6) % 7; // Mon=0..Sun=6
}
function ymd(s: string) {
  return s?.slice(0, 10);
}

export function QuickOrderPanel({
  token,
  ordersBase,
  children,
  orders,
  selectedDay,
  onSelectDay,
  selectedOrders,
  onCancelOrder,
}: {
  token: string;
  ordersBase: string;
  children: Child[];
  orders: Order[];
  selectedDay: string;
  onSelectDay: (day: string) => void;

  selectedOrders: Order[]; // toate comenzile din ziua selectată
  onCancelOrder: (order: Order) => void;
  cancelingId: string | null;
}) {
  const nav = useNavigate();

  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const monthLabel = useMemo(
    () => cursor.toLocaleString(undefined, { month: "long", year: "numeric" }),
    [cursor]
  );

  const range = useMemo(() => {
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    return { start, end };
  }, [cursor]);

  // bulk defaults
  const [bulkChildId, setBulkChildId] = useState<string>(() => children?.[0]?.id ?? "");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);
  const [bulkErr, setBulkErr] = useState<string | null>(null);

  // ordersByDay for dots/status (pe TOATE comenzile)
  const ordersByDay = useMemo(() => {
    const m = new Map<string, Order[]>();
    for (const o of orders ?? []) {
      const day = ymd(o.orderDate);
      m.set(day, [...(m.get(day) ?? []), o]);
    }
    return m;
  }, [orders]);

  function prevMonth() {
    setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function nextMonth() {
    setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  // grid weeks
  const weeks = useMemo(() => {
    const start = new Date(range.start);
    const end = new Date(range.end);

    const startOffset = mondayFirstIndex(start.getDay());
    const gridStart = new Date(start);
    gridStart.setDate(start.getDate() - startOffset);

    const endOffset = 6 - mondayFirstIndex(end.getDay());
    const gridEnd = new Date(end);
    gridEnd.setDate(end.getDate() + endOffset);

    const days: Date[] = [];
    for (let d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }

    const chunks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) chunks.push(days.slice(i, i + 7));
    return chunks;
  }, [range]);

  function dayMeta(day: string) {
    const list = ordersByDay.get(day) ?? [];
    if (!list.length) return null;

    const hasConfirmed = list.some((o) => o.status === "CONFIRMED");
    const hasPending = list.some((o) => o.status === "PENDING");
    const hasCanceled = list.some((o) => o.status === "CANCELED");

    if (hasConfirmed) return { tone: "ok" as const, text: "CONFIRMED" };
    if (hasPending) return { tone: "warn" as const, text: "PENDING" };
    if (hasCanceled) return { tone: "bad" as const, text: "CANCELED" };
    return { tone: "ok" as const, text: "ORDER" };
  }

  function cellStyle(day: string) {
    const meta = dayMeta(day);

    const base: React.CSSProperties = {
      padding: 10,
      borderRadius: 12,
      textAlign: "left",
      border: "1px solid #eee",
      background: "#fff",
      cursor: "pointer",
      position: "relative",
    };

    if (!meta) return base;
    if (meta.tone === "ok") return { ...base, background: "#e6ffef", border: "1px solid #b7f0c7" };
    if (meta.tone === "warn") return { ...base, background: "#fff7e6", border: "1px solid #ffe2a8" };
    return { ...base, background: "#ffe6e6", border: "1px solid #ffb6b6" };
  }

  // selectedDay actions:
  const hasOrdersSelectedDay = (selectedOrders?.length ?? 0) > 0;
  const canCancelAny = selectedOrders.some((o) => o.status === "PENDING");

  function SelectedPrimaryButton() {
    if (!hasOrdersSelectedDay) {
      return (
        <button
          onClick={() => nav(`/menus/${selectedDay}`)}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #111",
            background: "#111",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 900,
          }}
        >
          Continuă → selectează meniul ({selectedDay})
        </button>
      );
    }
    return (
      <button
        onClick={() => nav(`/menus/${selectedDay}`)}
        style={{
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid #111",
          background: "#111",
          color: "#fff",
          cursor: "pointer",
          fontWeight: 900,
        }}
      >
        Update menu ({selectedDay})
      </button>
    );
  }

  async function bulkFillMonth() {
    if (!token) return;
    if (!bulkChildId) return;

    try {
      setBulkErr(null);
      setBulkMsg(null);
      setBulkLoading(true);

      const from = toYMD(range.start);
      const to = toYMD(range.end);

      await apiPost(`${ordersBase}/orders/monthly-defaults`, token, {
        childId: bulkChildId,
        from,
        to,
      });

      setBulkMsg("✅ Defaulturile lunii au fost generate.");
    } catch (e: any) {
      setBulkErr(e?.message ?? "Bulk failed");
    } finally {
      setBulkLoading(false);
    }
  }

  // keep bulkChildId in sync when children load
  if (!bulkChildId && children?.[0]?.id) setBulkChildId(children[0].id);

  return (
    <div
      style={{
        height: "100%",
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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h3 style={{ margin: 0 }}>Plasează / gestionează comandă</h3>

          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={prevMonth} style={{ padding: "6px 10px", borderRadius: 10 }}>
              ←
            </button>
            <div style={{ fontWeight: 900 }}>{monthLabel}</div>
            <button onClick={nextMonth} style={{ padding: "6px 10px", borderRadius: 10 }}>
              →
            </button>
          </div>
        </div>
      </div>

      {/* content scroll ONLY inside this panel if needed */}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 16 }}>
        {/* Calendar header */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginBottom: 8 }}>
          {["L", "Ma", "Mi", "J", "V", "S", "D"].map((d) => (
            <div key={d} style={{ fontSize: 12, opacity: 0.7, textAlign: "center" }}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{ display: "grid", gap: 8 }}>
          {weeks.map((w, idx) => (
            <div key={idx} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
              {w.map((day) => {
                const dayStr = toYMD(day);
                const inMonth = day.getMonth() === cursor.getMonth();
                const selected = dayStr === selectedDay;
                const meta = dayMeta(dayStr);

                return (
                  <button
                    key={dayStr}
                    onClick={() => onSelectDay(dayStr)}
                    style={{
                      ...cellStyle(dayStr),
                      opacity: inMonth ? 1 : 0.35,
                      outline: selected ? "2px solid #111" : "none",
                    }}
                    title={meta ? meta.text : "fără comandă"}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontWeight: 900 }}>{day.getDate()}</div>

                      {/* dot */}
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 999,
                          border: "1px solid rgba(0,0,0,0.15)",
                          background:
                            meta?.tone === "ok"
                              ? "#22c55e"
                              : meta?.tone === "warn"
                              ? "#f59e0b"
                              : meta?.tone === "bad"
                              ? "#ef4444"
                              : "transparent",
                          opacity: meta ? 1 : 0.2,
                        }}
                      />
                    </div>

                    <div style={{ marginTop: 6, fontSize: 11, opacity: 0.75 }}>
                      {meta ? meta.text : "—"}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            Zi selectată: <b>{selectedDay}</b>
          </div>

          <SelectedPrimaryButton />

          {/* Cancel (selected day) only if there is something cancelable */}
          {hasOrdersSelectedDay ? (
            <button
              onClick={() => {
                // anulează toate PENDING din ziua selectată (un click = foarte intuitiv)
                const pending = selectedOrders.filter((o) => o.status === "PENDING");
                if (!pending.length) return;

                if (!confirm(`Anulezi toate comenzile PENDING din ${selectedDay}?`)) return;
                pending.forEach((o) => onCancelOrder(o));
              }}
              disabled={!canCancelAny}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #ddd",
                background: "#fff",
                cursor: canCancelAny ? "pointer" : "not-allowed",
                opacity: canCancelAny ? 1 : 0.5,
                fontWeight: 900,
              }}
              title={!canCancelAny ? "Nu există comenzi PENDING în ziua selectată" : "Anulează comenzile PENDING"}
            >
              Cancel order (ziua selectată)
            </button>
          ) : null}

          {/* Bulk defaults */}
          <div style={{ marginTop: 8, borderTop: "1px solid #eee", paddingTop: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Default pentru luna curentă</div>

            <label style={{ fontSize: 12, opacity: 0.85 }}>
              Copil:
              <select
                value={bulkChildId}
                onChange={(e) => setBulkChildId(e.target.value)}
                style={{
                  marginLeft: 8,
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                }}
              >
                {(children ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.class})
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              <button
                onClick={bulkFillMonth}
                disabled={bulkLoading || !bulkChildId}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #ddd",
                  background: "#fff",
                  cursor: bulkLoading ? "not-allowed" : "pointer",
                  opacity: bulkLoading ? 0.6 : 1,
                  fontWeight: 900,
                }}
              >
                {bulkLoading ? "Generating…" : "Generează default (luna asta)"}
              </button>
            </div>

            {bulkMsg ? (
              <div style={{ marginTop: 10, background: "#e6ffef", padding: 10, borderRadius: 10, fontSize: 12 }}>
                {bulkMsg}
              </div>
            ) : null}

            {bulkErr ? (
              <div style={{ marginTop: 10, background: "#ffe6e6", padding: 10, borderRadius: 10, fontSize: 12 }}>
                {bulkErr}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
