import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export default function OwnerHome() {
  const [rows, setRows] = useState([]);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");

  function load() {
    api
      .get("/canteens/mine")
      .then((r) => setRows(r.data))
      .catch((e) => setErr(e.response?.data?.error || "Failed"));
  }

  useEffect(() => {
    load();
  }, []);

  async function add(e) {
    e.preventDefault();
    setErr("");
    try {
      await api.post("/canteens", { name });
      setName("");
      load();
    } catch (ex) {
      setErr(ex.response?.data?.error || "Could not create");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Owner console</h1>
      <form onSubmit={add} className="card flex max-w-xl flex-wrap items-end gap-3">
        <div className="flex-1">
          <label className="text-sm text-slate-600 dark:text-slate-400">New canteen name</label>
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Add another outlet"
          />
        </div>
        <button type="submit" className="rounded-xl bg-brand px-4 py-2 font-semibold text-white">
          Add
        </button>
      </form>
      {err && <p className="text-sm text-rose-600">{err}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((c) => (
          <div key={c.id} className="card space-y-3">
            <div>
              <h2 className="text-xl font-semibold">{c.name}</h2>
              <p className="text-xs text-slate-500">slug: {c.slug}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <Link className="rounded-lg bg-slate-100 px-3 py-1 dark:bg-slate-800" to={`/owner/${c.id}/menu`}>
                Menu
              </Link>
              <Link className="rounded-lg bg-slate-100 px-3 py-1 dark:bg-slate-800" to={`/owner/${c.id}/counter`}>
                Live counter
              </Link>
              <Link className="rounded-lg bg-slate-100 px-3 py-1 dark:bg-slate-800" to={`/owner/${c.id}/analytics`}>
                Analytics
              </Link>
              <Link className="rounded-lg bg-slate-100 px-3 py-1 dark:bg-slate-800" to={`/owner/${c.id}/forecast`}>
                AI forecast
              </Link>
              <Link className="rounded-lg bg-slate-100 px-3 py-1 dark:bg-slate-800" to={`/owner/${c.id}/staff`}>
                Staff
              </Link>
              <Link className="rounded-lg bg-slate-100 px-3 py-1 dark:bg-slate-800" to={`/owner/${c.id}/qr`}>
                QR code
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
