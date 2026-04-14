import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export default function Home() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    api
      .get("/canteens", { params: { q } })
      .then((r) => setRows(r.data))
      .catch((e) => setErr(e.response?.data?.error || "Failed to load"));
  }, [q]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Find a canteen</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Search by name, open the guest menu, or log in as owner/customer.
        </p>
      </div>
      <input
        className="w-full max-w-md rounded-xl border border-slate-300 bg-white px-4 py-2 dark:border-slate-700 dark:bg-slate-900"
        placeholder="Search…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {err && <p className="text-sm text-rose-600">{err}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map((c) => (
          <div key={c.id} className="card flex flex-col gap-3">
            <div>
              <h2 className="text-xl font-semibold">{c.name}</h2>
              <p className="text-xs text-slate-500">/{c.slug}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark"
                to={`/menu/${c.slug}`}
              >
                Guest menu (QR flow)
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
