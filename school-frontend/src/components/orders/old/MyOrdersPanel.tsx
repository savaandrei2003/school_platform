import type { CSSProperties } from "react";
import type { Order } from "../../../pages/Dashboard";

type Child = { id: string; name: string; class: string };

type SnapshotItem = { category: string; optionId: string; optionName: string };

function ymd(s: string) {
  return s?.slice(0, 10);
}

function pickFromSnapshot(snap: SnapshotItem[] | undefined, cat: string) {
  const arr = snap ?? [];
  return arr.find((x) => x.category === cat)?.optionName ?? "—";
}

export function MyOrdersPanel({
  orders,
  childMap,
  selectedDay,
  onSelectDay,
  onCancelOrder,
  cancelingId,
}: {
  orders: Order[]; // deja sorted, ideal
  childMap: Map<string, Child>;
  selectedDay: string;
  onSelectDay: (day: string) => void;
  onCancelOrder: (order: Order) => void;
  cancelingId: string | null;
}) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 12,
        background: "#fff",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        minHeight: 0,
      }}
    >
      {/* Header */}
      <div style={{ padding: 16, borderBottom: "1px solid #eee" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 10,
          }}
        >
          <h3 style={{ margin: 0 }}>Comenzile mele</h3>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Total: <b>{orders.length}</b>
          </div>
        </div>

        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
          Click pe o comandă ca să selectezi ziua (detalii în dreapta). Cancel doar pentru <b>PENDING</b>.
        </div>
      </div>

      {/* List (scroll only here) */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          padding: 16,
          paddingRight: 12,
        }}
      >
        {orders.length === 0 ? (
          <div style={{ opacity: 0.7 }}>Nu ai comenzi încă.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {orders.map((o) => {
              const day = ymd(o.orderDate);
              const child = childMap.get(o.childId);
              const snap = (o.selection?.snapshot ?? []) as SnapshotItem[];

              const canCancel = o.status === "PENDING";
              const busy = cancelingId === o.id;
              const selected = day === selectedDay;

              const pill: CSSProperties = {
                display: "inline-block",
                padding: "4px 8px",
                borderRadius: 999,
                fontSize: 12,
                border: "1px solid rgba(0,0,0,0.08)",
                fontWeight: 700,
                background:
                  o.status === "CONFIRMED"
                    ? "#e6ffef"
                    : o.status === "PENDING"
                    ? "#fff7e6"
                    : o.status === "CANCELED"
                    ? "#ffe6e6"
                    : "#f2f2f2",
              };

              return (
                <div
                  key={o.id}
                  onClick={() => onSelectDay(day)}
                  style={{
                    border: selected ? "2px solid #111" : "1px solid #eee",
                    borderRadius: 12,
                    padding: 12,
                    background: "#fff",
                    cursor: "pointer",
                  }}
                  title="Click pentru a selecta ziua"
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 900 }}>
                        {child?.name ?? "Copil"}{" "}
                        <span style={{ fontSize: 12, opacity: 0.7 }}>
                          ({child?.class ?? "?"})
                        </span>
                      </div>

                      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                        <b>{day}</b> • <span style={pill}>{o.status}</span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCancelOrder(o);
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
                      <b>SOUP:</b> {pickFromSnapshot(snap, "SOUP")}
                    </div>
                    <div>
                      <b>MAIN:</b> {pickFromSnapshot(snap, "MAIN")}
                    </div>
                    <div>
                      <b>DESSERT:</b> {pickFromSnapshot(snap, "DESSERT")}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
