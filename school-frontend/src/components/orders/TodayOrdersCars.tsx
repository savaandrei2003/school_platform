import { useMemo } from "react";
import { OrderCard, type Order } from "./OrderCard";

type Child = { id: string; name: string; class: string };

export function TodayOrdersCard({
  todayOrders,
  children,
  token,
  ordersBase,
  reload,
}: {
  todayOrders: Order[];
  children: Child[];
  token: string;
  ordersBase: string;
  reload: () => Promise<void> | void;
}) {
  const childMap = useMemo(() => {
    const m = new Map<string, Child>();
    for (const c of children ?? []) m.set(c.id, c);
    return m;
  }, [children]);

  const grouped = useMemo(() => {
    const byChild = new Map<string, Order[]>();
    for (const o of todayOrders ?? []) {
      byChild.set(o.childId, [...(byChild.get(o.childId) ?? []), o]);
    }
    return [...byChild.entries()];
  }, [todayOrders]);

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
      {/* <h3 style={{ marginTop: 0 }}>Mâncarea de azi</h3> */}

      {todayOrders.length === 0 ? (
        <div style={{ opacity: 0.7 }}>Nu există comenzi pentru azi.</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {grouped.map(([childId, list]) => (
            <OrderCard
              key={childId}
              order={list[0]}
              child={childMap.get(childId)}
              token={token}
              ordersBase={ordersBase}
              onChanged={reload}
            />
          ))}
        </div>
      )}
    </div>
  );
}
