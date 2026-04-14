import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";

const ICON_CLASSES = [
  "bg-brand/10 text-brand",
  "bg-emerald-500/10 text-emerald-700",
  "bg-amber-500/10 text-amber-700",
  "bg-violet-500/10 text-violet-700",
  "bg-rose-500/10 text-rose-700",
];

function itemIcon(name) {
  const label = (name || "?").trim();
  const initial = label[0]?.toUpperCase() || "?";
  const idx = label.charCodeAt(0) % ICON_CLASSES.length;
  return { initial, className: ICON_CLASSES[Math.abs(idx)] };
}

export default function Counter() {
  const { id } = useParams();
  const cid = Number(id);
  const [items, setItems] = useState([]);
  const [cart, setCart] = useState({});
  const [mode, setMode] = useState("cash");
  const [msg, setMsg] = useState("");
  const [pending, setPending] = useState([]);

  function loadPending() {
    api.get(`/orders/canteen/${cid}`).then((r) => {
      const p = r.data.filter((o) => o.status === "pending_payment");
      p.reverse();
      setPending(p);
    });
  }

  useEffect(() => {
    api.get(`/menu/canteen/${cid}`).then((r) => setItems(r.data.filter((i) => i.available)));
    loadPending();
  }, [cid]);

  const lines = useMemo(() => {
    return Object.entries(cart)
      .filter(([, q]) => q > 0)
      .map(([mid, q]) => {
        const it = items.find((x) => String(x.id) === mid);
        return it ? { menu_item_id: it.id, quantity: q, name: it.name, unit: it.price } : null;
      })
      .filter(Boolean);
  }, [cart, items]);

  const total = lines.reduce((s, l) => s + l.quantity * Number(l.unit), 0);

  function bump(mid, delta) {
    setCart((c) => {
      const next = { ...c, [mid]: Math.max(0, (c[mid] || 0) + delta) };
      return next;
    });
  }

  async function place() {
    setMsg("");
    try {
      const { data } = await api.post(`/orders/counter/${cid}`, {
        items: lines.map(({ menu_item_id, quantity }) => ({ menu_item_id, quantity })),
        payment_mode: mode,
      });
      setMsg(`Order #${data.token_number} · total ₹${Number(data.total).toFixed(2)}`);
      setCart({});
      loadPending();
    } catch (ex) {
      setMsg(ex.response?.data?.error || "Failed");
    }
  }

  async function markPaid(orderId) {
    await api.patch(`/orders/${orderId}/payment`, { payment_status: "paid" });
    loadPending();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Live billing</h1>
        <Link className="text-sm text-brand hover:underline" to="/owner">
          ← Back
        </Link>
      </div>
      <div className="card flex flex-wrap items-center gap-4">
        <label className="text-sm">Payment</label>
        <select
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="cash">Cash</option>
          <option value="upi">UPI (mark paid)</option>
        </select>
        <div className="text-lg font-semibold">Total ₹{total.toFixed(2)}</div>
        <button
          type="button"
          disabled={!lines.length}
          onClick={place}
          className="ml-auto rounded-xl bg-brand px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          Place order
        </button>
      </div>
      {msg && <p className="text-sm text-emerald-600">{msg}</p>}
      {pending.length > 0 && (
        <div className="card space-y-2 border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
          <h2 className="font-semibold text-amber-900 dark:text-amber-100">Awaiting cash confirmation</h2>
          <ul className="space-y-2 text-sm">
            {pending.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Token {o.token_number} · ₹{Number(o.total).toFixed(2)}
                </span>
                <button
                  type="button"
                  className="rounded-lg bg-emerald-600 px-3 py-1 text-white"
                  onClick={() => markPaid(o.id)}
                >
                  Mark paid
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <div key={it.id} className="card flex flex-col gap-3 transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center gap-3">
              {(() => {
                const icon = itemIcon(it.name);
                return (
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${icon.className}`}>
                    <span className="text-sm font-bold">{icon.initial}</span>
                  </div>
                );
              })()}
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{it.name}</p>
                <p className="text-slate-500">₹{Number(it.price).toFixed(2)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                className="h-10 w-10 rounded-lg bg-slate-100 text-xl font-bold dark:bg-slate-800"
                onClick={() => bump(it.id, -1)}
              >
                −
              </button>
              <span className="text-xl font-bold">{cart[it.id] || 0}</span>
              <button
                type="button"
                className="h-10 w-10 rounded-lg bg-brand text-xl font-bold text-white"
                onClick={() => bump(it.id, 1)}
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
