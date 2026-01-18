import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { Order } from "../../pages/Dashboard";

type Child = { id: string; name: string; class: string };
type SnapshotItem = { category: string; optionId: string; optionName: string };

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function todayYMDLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}
function isAfterCutoffLocal(now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setHours(9, 0, 0, 0);
  return now.getTime() > cutoff.getTime();
}

function statusPill(status: string) {
  const base: React.CSSProperties = {
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
    border: "1px solid rgba(0,0,0,0.08)",
    fontWeight: 800,
  };

  if (status === "PENDING") return { ...base, background: "#e6ffef" };
  if (status === "CONFIRMED") return { ...base, background: "#f2e8ff" };
  if (status === "CANCELED") return { ...base, background: "#f2f2f2", opacity: 0.6 };
  return { ...base, background: "#f2f2f2" };
}

export function SelectedDayOrdersPanel({
  selectedDay,
  orders,
  childMap,
  selectedChildId, 
  onCancelOrder,
  cancelingId,
}: {
  selectedDay: string;
  orders: Order[];
  childMap: Map<string, Child>;
  selectedChildId: string; // ✅
  onCancelOrder: (o: Order) => void | Promise<void>;
  cancelingId: string | null;
}) {
  const nav = useNavigate();

  const visibleOrders = useMemo(() => {
    return (orders ?? []).filter((o) => o.status !== "CANCELED" && o.childId === selectedChildId);
  }, [orders, selectedChildId]);

  const today = useMemo(() => todayYMDLocal(), []);
  const afterCutoffToday = useMemo(() => isAfterCutoffLocal(), []);
  const isPastDay = (day: string) => day < today;
  const isTodayLocked = (day: string) => day === today && afterCutoffToday;
  const isDayLocked = isPastDay(selectedDay) || isTodayLocked(selectedDay);

  const itemRowStyle: React.CSSProperties = {
    display: "flex",
    gap: 8,
    alignItems: "baseline",
    minWidth: 0,
  };
  const itemLabelStyle: React.CSSProperties = {
    fontWeight: 800,
    fontSize: 12,
    opacity: 0.75,
    whiteSpace: "nowrap",
  };
  const itemValueStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
    flex: "1 1 auto",
  };

  const selectedChild = childMap.get(selectedChildId);

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
          Copil selectat: <b>{selectedChild ? `${selectedChild.name} (${selectedChild.class})` : "—"}</b>
          {isPastDay(selectedDay) ? <span style={{ marginLeft: 8 }}>(zi trecută)</span> : null}
          {isTodayLocked(selectedDay) ? <span style={{ marginLeft: 8 }}>(azi după 09:00)</span> : null}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 16, paddingRight: 12 }}>
        {!selectedChildId ? (
          <div style={{ background: "#f7f7f7", border: "1px dashed #ddd", padding: 12, borderRadius: 12 }}>
            <div style={{ fontWeight: 900 }}>Selectează un copil ca să vezi comenzile.</div>
          </div>
        ) : visibleOrders.length === 0 ? (
          <div style={{ background: "#f7f7f7", border: "1px dashed #ddd", padding: 12, borderRadius: 12 }}>
            <div style={{ fontWeight: 900 }}>Nu există comandă activă pentru copilul selectat în această zi.</div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {visibleOrders.map((o) => {
              const snap: SnapshotItem[] = (o.selection?.snapshot ?? []) as any;
              const pick = (cat: string) => snap.find((x) => x.category === cat)?.optionName ?? "—";

              const busy = cancelingId === o.id;
              const canUpdate = !isDayLocked;
              const canCancel = o.status === "PENDING" && !isDayLocked;

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
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 900 }}>
                        {selectedChild?.name ?? "Copil"}{" "}
                        <span style={{ fontSize: 12, opacity: 0.7 }}>({selectedChild?.class ?? "?"})</span>
                      </div>

                      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>
                        status: <span style={statusPill(o.status)}>{o.status}</span>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button
                        onClick={() => nav(`/menus/${selectedDay}?childId=${encodeURIComponent(selectedChildId)}`)}
                        disabled={!canUpdate}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 12,
                          border: "1px solid #111",
                          background: canUpdate ? "#111" : "#ddd",
                          color: canUpdate ? "#fff" : "#666",
                          cursor: canUpdate ? "pointer" : "not-allowed",
                          fontWeight: 900,
                          height: 42,
                          whiteSpace: "nowrap",
                        }}
                      >
                        Update
                      </button>

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
                      >
                        {busy ? "Canceling…" : "Cancel"}
                      </button>
                    </div>
                  </div>

                  {/* ✅ feluri pe orizontală (2 coloane) */}
                  <div
                    style={{
                      marginTop: 12,
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 8,
                      alignItems: "start",
                      minWidth: 0,
                    }}
                  >
                    <div style={itemRowStyle}>
                      <span style={itemLabelStyle}>SOUP:</span>
                      <span style={itemValueStyle} title={pick("SOUP")}>
                        {pick("SOUP")}
                      </span>
                    </div>

                    <div style={itemRowStyle}>
                      <span style={itemLabelStyle}>MAIN:</span>
                      <span style={itemValueStyle} title={pick("MAIN")}>
                        {pick("MAIN")}
                      </span>
                    </div>

                    <div style={itemRowStyle}>
                      <span style={itemLabelStyle}>DESSERT:</span>
                      <span style={itemValueStyle} title={pick("DESSERT")}>
                        {pick("DESSERT")}
                      </span>
                    </div>

                    {snap.some((x) => x.category === "RESERVE") ? (
                      <div style={itemRowStyle}>
                        <span style={itemLabelStyle}>RESERVE:</span>
                        <span style={itemValueStyle} title={pick("RESERVE")}>
                          {pick("RESERVE")}
                        </span>
                      </div>
                    ) : (
                      <div />
                    )}
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
