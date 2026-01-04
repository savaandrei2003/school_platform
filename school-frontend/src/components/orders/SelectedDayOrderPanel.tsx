// src/components/orders/SelectedDayOrdersPanel.tsx
import React from "react";
import type { Order } from "../../pages/Dashboard";

type Child = { id: string; name: string; class: string };
type SnapshotItem = { category: string; optionId: string; optionName: string };

function statusPill(status: string) {
  const base: React.CSSProperties = {
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
    border: "1px solid rgba(0,0,0,0.08)",
    fontWeight: 800,
  };
  if (status === "CONFIRMED") return { ...base, background: "#e6ffef" };
  if (status === "PENDING") return { ...base, background: "#fff7e6" };
  if (status === "CANCELED") return { ...base, background: "#ffe6e6" };
  return { ...base, background: "#f2f2f2" };
}

export function SelectedDayOrdersPanel({
  selectedDay,
  orders,
  childMap,
  onCancelOrder,
  cancelingId,
}: {
  selectedDay: string;
  orders: Order[]; // toate comenzile din zi
  childMap: Map<string, Child>;
  onCancelOrder: (o: Order) => void;
  cancelingId: string | null;
}) {
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <h3 style={{ margin: 0 }}>Comenzi pe ziua selectată</h3>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{selectedDay}</div>
        </div>

        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
          Aici vezi <b>toți copiii</b> (și poți anula individual).
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 16, paddingRight: 12 }}>
        {orders.length === 0 ? (
          <div style={{ background: "#f7f7f7", border: "1px dashed #ddd", padding: 12, borderRadius: 12 }}>
            <div style={{ fontWeight: 900 }}>Nu există comenzi pentru această zi.</div>
            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
              Folosește butonul din mijloc ca să plasezi o comandă.
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {orders.map((o) => {
              const child = childMap.get(o.childId);
              const snap: SnapshotItem[] = (o.selection?.snapshot ?? []) as any;
              const pick = (cat: string) => snap.find((x) => x.category === cat)?.optionName ?? "—";

              const canCancel = o.status === "PENDING";
              const busy = cancelingId === o.id;

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
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 900 }}>
                        {child?.name ?? "Copil"}{" "}
                        <span style={{ fontSize: 12, opacity: 0.7 }}>({child?.class ?? "?"})</span>
                      </div>

                      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>
                        status: <span style={statusPill(o.status)}>{o.status}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => onCancelOrder(o)}
                      disabled={!canCancel || busy}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "1px solid #ddd",
                        background: "#fff",
                        cursor: canCancel && !busy ? "pointer" : "not-allowed",
                        opacity: canCancel && !busy ? 1 : 0.5,
                        fontWeight: 900,
                        height: 42,
                        whiteSpace: "nowrap",
                      }}
                      title={canCancel ? "Anulează comanda" : "Poți anula doar PENDING (înainte de cutoff)"}
                    >
                      {busy ? "Canceling…" : "Cancel order"}
                    </button>
                  </div>

                  <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.6 }}>
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
  );
}
