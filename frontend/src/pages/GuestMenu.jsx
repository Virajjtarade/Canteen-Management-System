import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useParams } from "react-router-dom";
import { api, socketUrl } from "../api";
import { useAuth } from "../context/AuthContext";

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

export default function GuestMenu() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [cart, setCart] = useState({});
  const [mode, setMode] = useState("cash");
  const [guestLabel, setGuestLabel] = useState("");
  const [msg, setMsg] = useState("");
  const [ticket, setTicket] = useState(() => {
    try {
      const raw = localStorage.getItem("guest_ticket");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const ticketRef = useRef(ticket);
  useEffect(() => { ticketRef.current = ticket; }, [ticket]);

  // Auto-fill name from logged-in user (Google sign-in or registered account)
  useEffect(() => {
    if (user?.name && !guestLabel) {
      setGuestLabel(user.name);
    }
  }, [user]);

  useEffect(() => {
    api.get(`/public/canteen/${slug}/menu`).then((r) => setData(r.data));
  }, [slug]);

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!ticketRef.current?.canteen_id) return;
    const canteenId = ticketRef.current.canteen_id;
    const s = io(socketUrl(), { path: "/socket.io/" });
    s.emit("join_canteen", { canteen_id: canteenId, token: localStorage.getItem("token") });

    s.on("order_update", (payload) => {
      const cur = ticketRef.current;
      const matches =
        payload?.canteen_id === cur?.canteen_id &&
        (payload?.id === cur?.order_id || payload?.token_number === cur?.token_number);
      if (!matches) return;

      const newStatus = payload.status;
      const newMsg = `Order #${payload.token_number} is now ${newStatus}`;
      const updatedTicket = { ...(cur || {}), order_id: payload.id, status: newStatus };
      setTicket(updatedTicket);
      try {
        localStorage.setItem("guest_ticket", JSON.stringify(updatedTicket));
      } catch {
        // ignore
      }

      setMsg(newMsg);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          new Notification("Order update", { body: newMsg });
        } catch {
          // ignore
        }
      }
    });

    return () => s.disconnect();
  }, [ticket?.canteen_id]);

  // Determine popular threshold: top 3 items that have been ordered at least once
  const popularIds = useMemo(() => {
    if (!data?.items) return new Set();
    const withOrders = data.items.filter((it) => (it.order_count || 0) > 0);
    return new Set(withOrders.slice(0, 3).map((it) => it.id));
  }, [data]);

  const lines = useMemo(() => {
    if (!data) return [];
    return Object.entries(cart)
      .filter(([, q]) => q > 0)
      .map(([mid, q]) => {
        const it = data.items.find((x) => String(x.id) === mid);
        return it ? { menu_item_id: it.id, quantity: q } : null;
      })
      .filter(Boolean);
  }, [cart, data]);

  const total = useMemo(() => {
    if (!data) return 0;
    return lines.reduce((s, l) => {
      const it = data.items.find((x) => x.id === l.menu_item_id);
      return s + l.quantity * Number(it.price);
    }, 0);
  }, [data, lines]);

  function bump(id, delta) {
    setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] || 0) + delta) }));
  }

  async function place() {
    setMsg("");
    if (!guestLabel.trim()) {
      setMsg("Please enter your name before placing an order.");
      return;
    }
    if (!data || !lines.length) return;
    try {
      const { data: order } = await api.post(`/orders/canteen/${data.canteen.id}`, {
        items: lines,
        payment_mode: mode,
        guest_label: guestLabel,
      });

      setTicket({
        canteen_id: order.canteen_id,
        token_number: order.token_number,
        order_id: order.id,
        status: order.status,
      });
      try {
        localStorage.setItem(
          "guest_ticket",
          JSON.stringify({
            canteen_id: order.canteen_id,
            token_number: order.token_number,
            order_id: order.id,
            status: order.status,
          })
        );
      } catch {
        // ignore
      }

      setMsg(
        `Order placed · Token ${order.token_number} · ${order.status}. ${
          mode === "cash" ? "Pay cash at counter." : "Online payment confirmed."
        }`
      );
      setCart({});
    } catch (ex) {
      setMsg(ex.response?.data?.error || "Failed");
    }
  }

  if (!data) return <p className="text-center text-slate-500">Loading menu…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{data.canteen.name}</h1>
        <p className="text-slate-500">Guest ordering · no login required</p>
        {data.canteen.upi_id && (
          <p className="mt-2 text-sm">
            UPI ID: <span className="font-mono font-semibold">{data.canteen.upi_id}</span>
          </p>
        )}
      </div>
      <div className="card grid gap-3 md:grid-cols-2">
        <div>
          <label className="text-sm text-slate-600 dark:text-slate-400">Your name <span className="text-rose-500">*</span></label>
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            value={guestLabel}
            onChange={(e) => setGuestLabel(e.target.value)}
            autoComplete="name"
            required
            placeholder="Enter your name"
          />
        </div>
        <div>
          <label className="text-sm text-slate-600 dark:text-slate-400">Payment</label>
          <select
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="cash">Cash at counter</option>
            <option value="upi">UPI / online</option>
          </select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map((it) => {
          const isPopular = popularIds.has(it.id);
          const isAvailable = it.available !== false;
          return (
          <div
            key={it.id}
            className={`card relative flex flex-col gap-3 transition hover:-translate-y-0.5 hover:shadow-md ${
              isPopular && isAvailable
                ? "ring-2 ring-amber-400/70 shadow-amber-100 dark:ring-amber-500/50 dark:shadow-amber-900/20"
                : ""
            } ${!isAvailable ? "opacity-60 grayscale hover:translate-y-0 hover:shadow-none" : ""}`}
          >
            {isPopular && isAvailable && (
              <span className="absolute -top-2.5 right-3 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-sm">
                🔥 Popular
              </span>
            )}
            {!isAvailable && (
              <span className="absolute -top-2.5 right-3 inline-flex items-center gap-1 rounded-full bg-slate-500 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-sm">
                Unavailable
              </span>
            )}
            <div className="flex items-center gap-3">
              {(() => {
                const icon = itemIcon(it.name);
                return (
                  <div className={`flex h-11 w-11 items-center justify-center rounded-full ${icon.className}`}>
                    <span className="text-sm font-bold">{icon.initial}</span>
                  </div>
                );
              })()}
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-semibold">{it.name}</p>
                <div className="flex items-center gap-2">
                  <p className="text-slate-500">₹{Number(it.price).toFixed(2)}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <button 
                type="button" 
                className="h-10 w-10 rounded-lg bg-slate-100 text-xl dark:bg-slate-800 disabled:opacity-50" 
                disabled={!isAvailable}
                onClick={() => bump(it.id, -1)}
              >
                −
              </button>
              <span className="text-xl font-bold">{cart[it.id] || 0}</span>
              <button 
                type="button" 
                className="h-10 w-10 rounded-lg bg-brand text-xl font-bold text-white disabled:opacity-50" 
                disabled={!isAvailable}
                onClick={() => bump(it.id, 1)}
              >
                +
              </button>
            </div>
          </div>
          );
        })}
      </div>
      <div className="card flex flex-wrap items-center gap-4">
        <p className="text-lg font-semibold">Total ₹{total.toFixed(2)}</p>
        <button
          type="button"
          disabled={!lines.length}
          onClick={place}
          className="rounded-xl bg-brand px-6 py-2 font-semibold text-white disabled:opacity-50"
        >
          Place order
        </button>
      </div>
      {msg && <p className="text-sm text-emerald-600">{msg}</p>}
      {ticket && (
        <div className="card mt-2 rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">Your token: #{ticket.token_number}</span>
            <span className="text-xs text-slate-500">Canteen #{ticket.canteen_id}</span>
          </div>
          <p className="mt-2 text-slate-600 dark:text-slate-300">
            Current status:{" "}
            <span className="font-semibold capitalize">{String(ticket.status).replace("_", " ")}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Live updates will appear here when cook/server updates the order.
          </p>
        </div>
      )}
      <p className="text-xs text-slate-500">
        Track with canteen ID {data.canteen.id} and your token number (shown after order).
      </p>
    </div>
  );
}
