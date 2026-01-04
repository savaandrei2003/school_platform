import { apiDelete } from "../../api/http";

type SnapshotItem = { category: string; optionId: string; optionName: string };

export type Order = {
  id: string;
  childId: string;
  orderDate: string;
  status: "PENDING" | "CONFIRMED" | "CANCELED" | string;
  selection?: { choices: any; snapshot?: SnapshotItem[] };
};

type Child = { id: string; name: string; class: string };

export function OrderCard({
  order,
  child,
  token,
  ordersBase,
  onChanged,
}: {
  order: Order;
  child?: Child;
  token: string;
  ordersBase: string;
  onChanged?: () => void;
}) {
  const snap = order.selection?.snapshot ?? [];
  const pick = (cat: string) =>
    snap.find((x) => x.category === cat)?.optionName ?? "—";

  const canCancel = order.status === "PENDING";

  async function cancel() {
    if (!canCancel) return;
    if (!confirm("Sigur vrei să anulezi comanda?")) return;

    await apiDelete(`${ordersBase}/orders/${order.id}`, token);
    onChanged?.();
  }

  const tone =
    order.status === "CONFIRMED"
      ? "#e6ffef"
      : order.status === "PENDING"
      ? "#fff7e6"
      : "#ffe6e6";

  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 12,
        padding: 12,
        background: tone,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontWeight: 900 }}>
            {child?.name ?? "Copil"}{" "}
            <span style={{ fontSize: 12, opacity: 0.7 }}>
              ({child?.class ?? "?"})
            </span>
          </div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            <b>{order.orderDate.slice(0, 10)}</b> — status: <b>{order.status}</b>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {canCancel ? (
            <button
              onClick={cancel}
              style={{ padding: "8px 10px", borderRadius: 10 }}
            >
              Cancel
            </button>
          ) : (
            <button
              disabled
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                opacity: 0.5,
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {snap.length ? (
        <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.55 }}>
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
      ) : (
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
          Nu există snapshot.
        </div>
      )}
    </div>
  );
}
