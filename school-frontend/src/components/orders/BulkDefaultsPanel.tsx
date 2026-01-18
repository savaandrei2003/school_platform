import { useEffect, useMemo, useState } from "react";
import { apiPost } from "../../api/http";
import type { HighlightRange } from "./OrdersCalendarPanel";

type Child = { id: string; name: string; class: string };

export type DefaultPeriod = "MONTH" | "WEEK";
export type DefaultCategories = {
  SOUP: boolean;
  MAIN: boolean;
  DESSERT: boolean;
  RESERVE: boolean;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function toYMD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function parseYMD(ymd: string) {
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  return new Date(y, m - 1, d);
}
function mondayFirstIndex(jsDay: number) {
  return (jsDay + 6) % 7;
}
function weekRangeFromDay(ymd: string) {
  const dt = parseYMD(ymd);
  const offset = mondayFirstIndex(dt.getDay());
  const start = new Date(dt);
  start.setDate(dt.getDate() - offset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { from: toYMD(start), to: toYMD(end) };
}
function monthRangeFromDay(ymd: string) {
  const dt = parseYMD(ymd);
  const start = new Date(dt.getFullYear(), dt.getMonth(), 1);
  const end = new Date(dt.getFullYear(), dt.getMonth() + 1, 0);
  return { from: toYMD(start), to: toYMD(end) };
}

export function BulkDefaultsPanel({
  token,
  ordersBase,
  children,
  selectedDay,
  selectedChildId,                 
  onPreviewRange,
  onDone,
}: {
  token: string;
  ordersBase: string;
  children: Child[];
  selectedDay: string;
  selectedChildId: string;         
  onPreviewRange: (r: HighlightRange | null) => void;
  onDone: () => void;
}) {
  const [period, setPeriod] = useState<DefaultPeriod>("MONTH");
  const [previewOn, setPreviewOn] = useState(false);

  const [cats, setCats] = useState<DefaultCategories>({
    SOUP: true,
    MAIN: true,
    DESSERT: true,
    RESERVE: false,
  });

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [successScreen, setSuccessScreen] = useState(false);
  const [successText, setSuccessText] = useState<string>("");

  const selectedChild = useMemo(
    () => (children ?? []).find((c) => c.id === selectedChildId) ?? null,
    [children, selectedChildId]
  );

  const range = useMemo(() => {
    return period === "MONTH" ? monthRangeFromDay(selectedDay) : weekRangeFromDay(selectedDay);
  }, [period, selectedDay]);

  useEffect(() => {
    if (!previewOn) return;
    onPreviewRange({ ...range, active: true });
  }, [previewOn, range.from, range.to]);

  const hasAnyCategory = cats.SOUP || cats.MAIN || cats.DESSERT || cats.RESERVE;
  const hasMainOrReserve = cats.MAIN || cats.RESERVE;
  const canConfirm = Boolean(selectedChildId) && hasAnyCategory && hasMainOrReserve;

  const summary = useMemo(() => {
    const parts: string[] = [];
    if (cats.SOUP) parts.push("Soup");
    if (cats.MAIN) parts.push("Main");
    if (cats.RESERVE) parts.push("Reserve");
    if (cats.DESSERT) parts.push("Dessert");
    return parts.length ? parts.join(" + ") : "—";
  }, [cats]);

  function togglePeriod(next: DefaultPeriod) {
    if (period === next && previewOn) {
      setPreviewOn(false);
      onPreviewRange(null);
      return;
    }

    setPeriod(next);
    setPreviewOn(true);

    const r = next === "MONTH" ? monthRangeFromDay(selectedDay) : weekRangeFromDay(selectedDay);
    onPreviewRange({ ...r, active: true });
  }

  async function confirm() {
    if (!token || !canConfirm || loading) return;

    try {
      setErr(null);
      setLoading(true);

      await apiPost(`${ordersBase}/orders/monthly-defaults`, token, {
        childId: selectedChildId,    
        from: range.from,
        to: range.to,
      });

      setSuccessText(
        `Defaulturile au fost generate pentru ${selectedChild?.name ?? "copil"} (${period === "MONTH" ? "Lună" : "Săptămână"}: ${range.from} → ${range.to}).`
      );
      setSuccessScreen(true);

      setPreviewOn(false);
      onPreviewRange(null);

      onDone();

      window.setTimeout(() => {
        setSuccessScreen(false);
        setSuccessText("");
        setErr(null);
        setLoading(false);
      }, 10_000);
    } catch (e: any) {
      setErr(e?.message ?? "Bulk failed");
    } finally {
      setLoading(false);
    }
  }

  const chipPeriodStyle = (active: boolean): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid #ddd",
    background: active ? "#111" : "#fff",
    color: active ? "#fff" : "#111",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    userSelect: "none",
  });

  const catChipStyle = (checked: boolean): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 10px",
    borderRadius: 999,
    border: "1px solid #ddd",
    background: checked ? "#111" : "#fff",
    color: checked ? "#fff" : "#111",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    userSelect: "none",
  });

  if (successScreen) {
    return (
      <div
        style={{
          height: "100%",
          border: "1px solid #b7f0c7",
          borderRadius: 12,
          background: "#e6ffef",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        <div style={{ padding: 16, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: 0, fontWeight: 900 }}>✅ Comenzi generate</h3>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>Se revine automat la panou în ~10 secunde.</div>
        </div>

        <div style={{ flex: 1, padding: 16, display: "grid", placeItems: "center" }}>
          <div
            style={{
              width: "100%",
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 14,
              background: "rgba(255,255,255,0.7)",
              padding: 16,
              display: "grid",
              gap: 10,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 800 }}>{successText}</div>

            <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.5 }}>
              <div>
                <b>Copil:</b> {selectedChild?.name ?? "—"} ({selectedChild?.class ?? "—"})
              </div>
              <div>
                <b>Interval:</b> {range.from} → {range.to}
              </div>
              <div>
                <b>Categorii:</b> {summary}
              </div>
            </div>

            <div style={{ fontSize: 12, opacity: 0.7 }}>(UI-ul revine automat; comenzile apar după reload.)</div>
          </div>
        </div>
      </div>
    );
  }

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
          <h3 style={{ margin: 0, fontWeight: 800 }}>Default pe perioadă</h3>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            {previewOn ? `${range.from} → ${range.to}` : "Alege Lună/Săptămână pentru preview"}
          </div>
        </div>

        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
          Copil selectat: <b>{selectedChild ? `${selectedChild.name} (${selectedChild.class})` : "—"}</b>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          padding: 16,
          background: previewOn ? "#f6fffa" : "#fff",
          transition: "background 120ms ease",
        }}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 700 }}>Perioadă (preview)</div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" onClick={() => togglePeriod("MONTH")} style={chipPeriodStyle(period === "MONTH" && previewOn)}>
                {period === "MONTH" && previewOn ? "✓ " : ""}Luna
              </button>
              <button type="button" onClick={() => togglePeriod("WEEK")} style={chipPeriodStyle(period === "WEEK" && previewOn)}>
                {period === "WEEK" && previewOn ? "✓ " : ""}Săptămâna
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 700 }}>Categorii</div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <label style={catChipStyle(cats.SOUP)}>
                <input type="checkbox" checked={cats.SOUP} onChange={(e) => setCats((c) => ({ ...c, SOUP: e.target.checked }))} style={{ display: "none" }} />
                {cats.SOUP ? "✓ " : ""}Soup
              </label>

              <label style={catChipStyle(cats.MAIN)}>
                <input type="checkbox" checked={cats.MAIN} onChange={(e) => setCats((c) => ({ ...c, MAIN: e.target.checked }))} style={{ display: "none" }} />
                {cats.MAIN ? "✓ " : ""}Main
              </label>

              <label style={catChipStyle(cats.RESERVE)}>
                <input type="checkbox" checked={cats.RESERVE} onChange={(e) => setCats((c) => ({ ...c, RESERVE: e.target.checked }))} style={{ display: "none" }} />
                {cats.RESERVE ? "✓ " : ""}Reserve
              </label>

              <label style={catChipStyle(cats.DESSERT)}>
                <input type="checkbox" checked={cats.DESSERT} onChange={(e) => setCats((c) => ({ ...c, DESSERT: e.target.checked }))} style={{ display: "none" }} />
                {cats.DESSERT ? "✓ " : ""}Dessert
              </label>
            </div>

            {!hasMainOrReserve ? (
              <div style={{ fontSize: 12, background: "#fff7e6", border: "1px solid #ffe2a8", padding: 10, borderRadius: 10 }}>
                Trebuie să ai selectat <b>Main</b> sau <b>Reserve</b>.
              </div>
            ) : null}
          </div>

          {canConfirm ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <button
                onClick={confirm}
                disabled={loading}
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid #111",
                  background: "#111",
                  color: "#fff",
                  fontWeight: 900,
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? "Se generează…" : "Confirmă cererea"}
              </button>

              {previewOn ? (
                <button
                  type="button"
                  onClick={() => {
                    setPreviewOn(false);
                    onPreviewRange(null);
                  }}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid #ddd",
                    background: "#fff",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Oprește preview
                </button>
              ) : null}
            </div>
          ) : (
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Ca să apară confirmarea: selectează <b>Main</b> sau <b>Reserve</b> (și să existe copil selectat).
            </div>
          )}

          {err ? <div style={{ background: "#ffe6e6", padding: 10, borderRadius: 10, fontSize: 12 }}>{err}</div> : null}
        </div>
      </div>
    </div>
  );
}
