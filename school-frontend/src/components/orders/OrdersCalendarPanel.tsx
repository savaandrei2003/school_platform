import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Order } from "../../pages/Dashboard";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toYMD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function mondayFirstIndex(jsDay: number) {
  return (jsDay + 6) % 7;
}

function ymd(s: string) {
  return s?.slice(0, 10);
}

export type HighlightRange = { from: string; to: string; active: boolean };

type Child = { id: string; name: string; class: string };

function todayYMDLocal() {
  const now = new Date();
  const y = now.getFullYear();
  const m = pad2(now.getMonth() + 1);
  const d = pad2(now.getDate());
  return `${y}-${m}-${d}`;
}

function isAfterCutoffLocal(now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setHours(9, 0, 0, 0);
  return now.getTime() > cutoff.getTime();
}

export function OrdersCalendarPanel({
  orders,
  children,
  selectedDay,
  onSelectDay,
  selectedChildId,
  onSelectChildId,
  highlight,
  loading,
}: {
  orders: Order[];
  children: Child[];

  selectedDay: string;
  onSelectDay: (day: string) => void;

  selectedChildId: string;
  onSelectChildId: (id: string) => void;

  highlight: HighlightRange | null;
  loading?: boolean;
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

  const visibleOrders = useMemo(() => {
    return (orders ?? []).filter((o) => o.status !== "CANCELED");
  }, [orders]);

  const ordersByDay = useMemo(() => {
    const m = new Map<string, Order[]>();
    for (const o of visibleOrders) {
      const day = ymd(o.orderDate);
      m.set(day, [...(m.get(day) ?? []), o]);
    }
    return m;
  }, [visibleOrders]);

  function dayMeta(day: string) {
    if (!selectedChildId) return null; 

    const listAll = ordersByDay.get(day) ?? [];
    const list = listAll.filter((o) => o.childId === selectedChildId); 
    if (!list.length) return null;

    const hasPending = list.some((o) => o.status === "PENDING");
    const hasConfirmed = list.some((o) => o.status === "CONFIRMED");

    if (hasPending) return { tone: "pending" as const, text: "ORDER" };
    if (hasConfirmed) return { tone: "confirmed" as const, text: "CONFIRMED" };
    return null;
  }

  function prevMonth() {
    setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function nextMonth() {
    setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

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

  const hasOrderForSelectedChild = useMemo(() => {
    if (!selectedChildId) return false;
    const list = ordersByDay.get(selectedDay) ?? [];
    return list.some((o) => o.childId === selectedChildId && o.status !== "CANCELED");
  }, [ordersByDay, selectedDay, selectedChildId]);

  function inHighlight(day: string) {
    if (!highlight?.active) return false;
    return day >= highlight.from && day <= highlight.to;
  }

  const today = useMemo(() => todayYMDLocal(), []);
  const afterCutoffToday = useMemo(() => isAfterCutoffLocal(), []);

  const isPastDay = (day: string) => day < today; 
  const isTodayLocked = (day: string) => day === today && afterCutoffToday;

  function cellStyle(day: string, selected: boolean, inMonth: boolean): React.CSSProperties {
    const meta = dayMeta(day);

    const base: React.CSSProperties = {
      padding: 10,
      borderRadius: 12,
      textAlign: "left",
      border: "1px solid #eee",
      background: "#fff",
      cursor: "pointer",
      position: "relative",
      opacity: inMonth ? 1 : 0.35,
      outline: selected ? "2px solid #111" : "none",
      boxShadow: inHighlight(day) ? "inset 0 0 0 2px rgba(17,17,17,0.35)" : "none",
      transition: "transform 120ms ease, opacity 120ms ease",
    };

    let styled = base;
    if (!meta) styled = base;
    else if (meta.tone === "pending") styled = { ...base, background: "#e6ffef", border: "1px solid #b7f0c7" };
    else if (meta.tone === "confirmed") styled = { ...base, background: "#f2e8ff", border: "1px solid #d3b7ff" };

    if (isPastDay(day)) {
      styled = {
        ...styled,
        cursor: "not-allowed",
        opacity: (inMonth ? 1 : 0.35) * 0.45,
      };
    }

    return styled;
  }

  const canGo = !!selectedChildId && !isPastDay(selectedDay) && !isTodayLocked(selectedDay);

  const selectedChild = useMemo(() => {
    return (children ?? []).find((c) => c.id === selectedChildId) ?? null;
  }, [children, selectedChildId]);

  const actionLabel = hasOrderForSelectedChild
    ? `Update menu (${selectedDay})`
    : `Continuă → selectează meniul (${selectedDay})`;

  const actionHint = !selectedChildId
    ? "Alege copilul înainte să continui"
    : isPastDay(selectedDay)
    ? "Zi trecută (blocată)"
    : isTodayLocked(selectedDay)
    ? "După 09:00 nu se mai pot face modificări pentru azi"
    : "Deschide meniul zilei";

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
      {/* HEADER */}
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

        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
          Click pe o zi ca să vezi comenzile din dreapta jos. {loading ? "Loading…" : ""}
        </div>

        {/* Child picker */}
        <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontSize: 12, opacity: 0.85 }}>
            Copil:
            <select
              value={selectedChildId}
              onChange={(e) => onSelectChildId(e.target.value)}
              style={{
                marginLeft: 8,
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #ddd",
                minWidth: 220,
              }}
            >
              <option value="">— alege copil —</option>
              {(children ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.class})
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* CALENDAR (scroll) */}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 16 }}>
        {/* header zile */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginBottom: 8 }}>
          {["L", "Ma", "Mi", "J", "V", "S", "D"].map((d) => (
            <div key={d} style={{ fontSize: 12, opacity: 0.7, textAlign: "center" }}>
              {d}
            </div>
          ))}
        </div>

        {/* grid */}
        <div style={{ display: "grid", gap: 8 }}>
          {weeks.map((w, idx) => (
            <div key={idx} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
              {w.map((day) => {
                const dayStr = toYMD(day);
                const inMonth = day.getMonth() === cursor.getMonth();
                const selected = dayStr === selectedDay;
                const meta = dayMeta(dayStr);

                const disabledDay = isPastDay(dayStr);

                return (
                  <button
                    key={dayStr}
                    onClick={() => {
                      if (disabledDay) return;
                      onSelectDay(dayStr);
                    }}
                    disabled={disabledDay}
                    style={cellStyle(dayStr, selected, inMonth)}
                    title={
                      disabledDay
                        ? "Zi trecută (blocată)"
                        : !selectedChildId
                        ? "Alege copil ca să vezi statusul zilei"
                        : meta
                        ? meta.text
                        : "fără comandă"
                    }
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontWeight: 900 }}>{day.getDate()}</div>

                      {/*  */}
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 999,
                          border: "1px solid rgba(0,0,0,0.15)",
                          background:
                            meta?.tone === "pending"
                              ? "#22c55e"
                              : meta?.tone === "confirmed"
                              ? "#a855f7"
                              : "transparent",
                          opacity: meta ? 1 : 0.2,
                        }}
                      />
                    </div>

                    <div style={{ marginTop: 6, fontSize: 11, opacity: 0.75 }}>{meta ? meta.text : "—"}</div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {highlight?.active ? (
          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.75 }}>
            Preview activ: <b>{highlight.from}</b> → <b>{highlight.to}</b>
          </div>
        ) : null}
      </div>

      {/* ACTION BAR */}
      <div
        style={{
          borderTop: "1px solid #eee",
          padding: 16,
          background: "#fff",
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          Zi selectată: <b>{selectedDay}</b>
          {isPastDay(selectedDay) ? <span style={{ marginLeft: 8 }}>(zi trecută)</span> : null}
          {isTodayLocked(selectedDay) ? <span style={{ marginLeft: 8 }}>(azi după 09:00)</span> : null}
        </div>

        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>
            Pentru copilul{" "}
            <span style={{ fontWeight: 900 }}>
              {selectedChild ? `${selectedChild.name} (${selectedChild.class})` : "— (nu e selectat)"}
            </span>{" "}
            fă următoarea acțiune:
          </div>

          <button
            onClick={() => nav(`/menus/${selectedDay}?childId=${encodeURIComponent(selectedChildId)}`)}
            disabled={!canGo}
            style={{
              padding: "14px 14px",
              borderRadius: 14,
              border: "1px solid #111",
              background: canGo ? "#111" : "#ddd",
              color: canGo ? "#fff" : "#666",
              cursor: canGo ? "pointer" : "not-allowed",
              fontWeight: 900,
              fontSize: 15,
              boxShadow: canGo ? "0 8px 20px rgba(0,0,0,0.12)" : "none",
            }}
            title={actionHint}
          >
            {actionLabel}
          </button>

          {!canGo ? <div style={{ fontSize: 12, opacity: 0.7 }}>{actionHint}</div> : null}
        </div>
      </div>
    </div>
  );
}
