import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost } from "../../api/http";

type Child = { id: string; name: string; class: string };
type Order = { id: string; childId: string; orderDate: string; status: string };

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function toYMD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function mondayFirstIndex(jsDay: number) {
  // JS: Sun=0..Sat=6 => Mon=0..Sun=6
  return (jsDay + 6) % 7;
}

export function QuickOrderPanel({
  token,
  ordersBase,
  children,
  orders,
}: {
  token: string;
  ordersBase: string;
  children: Child[];
  orders: Order[];
}) {
  const nav = useNavigate();

  // month cursor
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

  // selected day in month (default: today if in same month, else first day)
  const [selectedDay, setSelectedDay] = useState(() => {
    const now = new Date();
    const sameMonth = now.getFullYear() === cursor.getFullYear() && now.getMonth() === cursor.getMonth();
    return toYMD(sameMonth ? now : new Date(cursor.getFullYear(), cursor.getMonth(), 1));
  });

  // selected child for bulk
  const [bulkChildId, setBulkChildId] = useState<string>(() => children?.[0]?.id ?? "");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);
  const [bulkErr, setBulkErr] = useState<string | null>(null);

  // Orders map by day (for dots/colors)
  const ordersByDay = useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const o of orders ?? []) {
      const ymd = o.orderDate.slice(0, 10);
      map.set(ymd, [...(map.get(ymd) ?? []), o]);
    }
    return map;
  }, [orders]);

  function prevMonth() {
    setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function nextMonth() {
    setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  // rebuild grid weeks for this month
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

  function dayMeta(ymd: string) {
    const list = ordersByDay.get(ymd) ?? [];
    if (!list.length) return null;

    const hasConfirmed = list.some((o) => o.status === "CONFIRMED");
    const hasPending = list.some((o) => o.status === "PENDING");
    const hasCanceled = list.some((o) => o.status === "CANCELED");

    if (hasConfirmed) return { tone: "ok" as const, text: "CONFIRMED" };
    if (hasPending) return { tone: "warn" as const, text: "PENDING" };
    if (hasCanceled) return { tone: "bad" as const, text: "CANCELED" };
    return { tone: "ok" as const, text: "ORDER" };
  }

  function cellStyle(ymd: string) {
    const meta = dayMeta(ymd);

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

  function goToSelectedDay() {
    nav(`/menus/${selectedDay}`);
  }

  // keep bulk childId in sync when children load
  // (only if not set yet)
  if (!bulkChildId && children?.[0]?.id) {
    setBulkChildId(children[0].id);
  }

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>Plasează comandă</h3>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={prevMonth}>←</button>
          <div style={{ fontWeight: 800, paddingTop: 4 }}>{monthLabel}</div>
          <button onClick={nextMonth}>→</button>
        </div>
      </div>

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
              const ymd = toYMD(day);
              const inMonth = day.getMonth() === cursor.getMonth();
              const selected = ymd === selectedDay;
              const meta = dayMeta(ymd);

              return (
                <button
                  key={ymd}
                  onClick={() => setSelectedDay(ymd)}
                  style={{
                    ...cellStyle(ymd),
                    opacity: inMonth ? 1 : 0.35,
                    outline: selected ? "2px solid #111" : "none",
                  }}
                  title={meta ? meta.text : "fără comandă"}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 800 }}>{day.getDate()}</div>

                    {/* Bulină status */}
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

        <button
          onClick={goToSelectedDay}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #111",
            background: "#111",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 800,
          }}
        >
          Comandă pentru {selectedDay}
        </button>

        <div style={{ marginTop: 6, borderTop: "1px solid #eee", paddingTop: 10 }}>
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
                fontWeight: 700,
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
  );
}
