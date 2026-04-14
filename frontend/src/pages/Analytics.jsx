import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import { api } from "../api";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

export default function Analytics() {
  const { id } = useParams();
  const [range, setRange] = useState("week");
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api
      .get(`/analytics/canteen/${id}/summary`, { params: { range } })
      .then((r) => setData(r.data))
      .catch((e) => setErr(e.response?.data?.error || "Failed"));
  }, [id, range]);

  const chart =
    data &&
    data.peak_hours?.length > 0 && {
      labels: data.peak_hours.map((h) => `${h.hour}:00`),
      datasets: [
        {
          label: "Orders",
          data: data.peak_hours.map((h) => h.orders),
          backgroundColor: "rgba(13,148,136,0.6)",
        },
      ],
    };

  const insight = (() => {
    if (!data) return null;
    const peak = (data.peak_hours || []).reduce((best, h) => (h.orders > best.orders ? h : best), { hour: 0, orders: 0 });
    const top = data.top_items?.[0];
    const totalTopQty = (data.top_items || []).reduce((s, t) => s + (t.quantity || 0), 0);
    const share = top && totalTopQty ? Math.round((top.quantity / totalTopQty) * 100) : 0;
    return { peakHour: peak.hour, peakOrders: peak.orders, topName: top?.name || "—", topShare: share };
  })();

  const doughnut =
    data &&
    data.top_items?.length > 0 && {
      labels: data.top_items.map((t) => t.name),
      datasets: [
        {
          data: data.top_items.map((t) => t.quantity),
          backgroundColor: [
            "rgba(13,148,136,0.65)",
            "rgba(59,130,246,0.65)",
            "rgba(245,158,11,0.65)",
            "rgba(168,85,247,0.65)",
            "rgba(244,63,94,0.65)",
            "rgba(16,185,129,0.65)",
            "rgba(234,179,8,0.65)",
            "rgba(99,102,241,0.65)",
            "rgba(251,191,36,0.65)",
            "rgba(236,72,153,0.65)",
          ],
        },
      ],
    };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Analytics</h1>
        <Link className="text-sm text-brand hover:underline" to="/owner">
          ← Back
        </Link>
      </div>
      <div className="card flex flex-wrap items-center gap-3">
        <label className="text-sm">Range</label>
        <select
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
          value={range}
          onChange={(e) => setRange(e.target.value)}
        >
          <option value="day">Day</option>
          <option value="week">Week</option>
          <option value="fortnight">Fortnight</option>
          <option value="month">Month</option>
          <option value="year">Year</option>
        </select>
        <button
          type="button"
          className="ml-auto text-sm text-brand hover:underline"
          onClick={() => {
            api
              .get(`/analytics/canteen/${id}/export.csv`, {
                params: { range },
                responseType: "blob",
              })
              .then((r) => {
                const u = URL.createObjectURL(r.data);
                const a = document.createElement("a");
                a.href = u;
                a.download = `orders_${id}.csv`;
                a.click();
              });
          }}
        >
          Export CSV
        </button>
      </div>
      {err && <p className="text-rose-600">{err}</p>}
      {data && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="card">
            <p className="text-sm text-slate-500">Revenue</p>
            <p className="text-3xl font-bold">₹{data.revenue.toFixed(2)}</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">Orders</p>
            <p className="text-3xl font-bold">{data.order_count}</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">Top item</p>
            <p className="text-xl font-semibold">{data.top_items[0]?.name || "—"}</p>
          </div>
        </div>
      )}

      {insight && (
        <div className="card">
          <h2 className="mb-1 font-semibold">Brief analysis</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Peak time is around <span className="font-semibold">{insight.peakHour}:00</span> with{" "}
            <span className="font-semibold">{insight.peakOrders}</span> orders. Top item is{" "}
            <span className="font-semibold">{insight.topName}</span> (~{insight.topShare}% of top-10 item quantity).
          </p>
        </div>
      )}
      {chart && (
        <div className="card">
          <h2 className="mb-4 font-semibold">Peak hours</h2>
          <Bar
            data={chart}
            options={{
              responsive: true,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (ctx) => ` ${ctx.parsed.y} orders`,
                  },
                },
              },
              scales: { x: { grid: { display: false } } },
            }}
          />
        </div>
      )}
      {doughnut && (
        <div className="card">
          <h2 className="mb-4 font-semibold">Top items mix</h2>
          <Doughnut
            data={doughnut}
            options={{
              plugins: {
                legend: { position: "bottom" },
                tooltip: {
                  callbacks: {
                    label: (ctx) => ` ${ctx.label}: ${ctx.parsed} qty`,
                  },
                },
              },
            }}
          />
        </div>
      )}
      {data?.top_items?.length > 0 && (
        <div className="card">
          <h2 className="mb-3 font-semibold">Most sold</h2>
          <ul className="space-y-2 text-sm">
            {data.top_items.map((t) => (
              <li key={t.name} className="flex justify-between">
                <span>{t.name}</span>
                <span className="text-slate-500">{t.quantity} sold</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
