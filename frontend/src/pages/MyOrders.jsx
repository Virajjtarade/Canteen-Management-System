import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { api, socketUrl } from "../api";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import { playCustomerBeep } from "../utils/audio";

export default function MyOrders() {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [rows, setRows] = useState([]);
  const [token, setToken] = useState("");
  const [cid, setCid] = useState("");
  const [tracked, setTracked] = useState(null);
  const [notice, setNotice] = useState("");
  const prevJoinedRef = useRef("");

  useEffect(() => {
    api.get("/orders/mine").then((r) => setRows(r.data));
  }, []);

  useEffect(() => {
    if (!user) return;
    const canteenIds = [...new Set(rows.map((o) => o.canteen_id))].sort();
    const joinedKey = canteenIds.join(",");
    if (joinedKey === prevJoinedRef.current && prevJoinedRef.current !== "") return;
    prevJoinedRef.current = joinedKey;

    const s = io(socketUrl(), { path: "/socket.io/" });
    const authToken = localStorage.getItem("token");
    canteenIds.forEach((canteenId) => s.emit("join_canteen", { canteen_id: canteenId, token: authToken }));

    s.on("order_update", (payload) => {
      if (payload.customer_id !== user.id) return;
      setRows((prev) => prev.map((o) => (o.id === payload.id ? payload : o)));
      const msg = `Order #${payload.token_number} is now ${payload.status}`;
      setNotice(msg);
      addNotification(msg);
      playCustomerBeep();
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          new Notification("Order update", { body: msg });
        } catch {
          // ignore
        }
      }
    });
    return () => s.disconnect();
  }, [rows, user]);

  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  async function track(e) {
    e.preventDefault();
    setTracked(null);
    const { data } = await api.get("/public/track", {
      params: { canteen_id: cid, token },
    });
    setTracked(data);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">My orders</h1>
        <p className="text-slate-500">Signed-in customer orders</p>
      </div>
      {notice && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{notice}</p>}
      <div className="card space-y-3">
        <h2 className="font-semibold">Track by token (guest or yours)</h2>
        <form className="flex flex-wrap gap-2" onSubmit={track}>
          <input
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            placeholder="Canteen ID"
            value={cid}
            onChange={(e) => setCid(e.target.value)}
            required
          />
          <input
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            placeholder="Token #"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
          />
          <button type="submit" className="rounded-xl bg-brand px-4 py-2 font-semibold text-white">
            Track
          </button>
        </form>
        {tracked && (
          <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800">
            <p>
              Token {tracked.token_number} · {tracked.status} · ₹{Number(tracked.total).toFixed(2)}
            </p>
          </div>
        )}
      </div>
      <div className="space-y-3">
        {rows.map((o) => (
          <div key={o.id} className="card flex flex-wrap justify-between gap-2">
            <div>
              <p className="font-semibold">
                Canteen #{o.canteen_id} · Token {o.token_number}
              </p>
              <p className="text-sm text-slate-500">{o.status}</p>
            </div>
            <div className="text-right font-semibold">₹{Number(o.total).toFixed(2)}</div>
          </div>
        ))}
        {!rows.length && <p className="text-slate-500">No orders yet.</p>}
      </div>
    </div>
  );
}
