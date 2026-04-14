import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

function CanteenSettings({ canteen, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [wa, setWa] = useState(canteen.whatsapp_number || "");
  const [msg, setMsg] = useState("");

  async function save(e) {
    e.preventDefault();
    setMsg("");
    try {
      const { data } = await api.patch(`/canteens/${canteen.id}`, { whatsapp_number: wa });
      onUpdate(data);
      setMsg("Saved!");
      setTimeout(() => setOpen(false), 1000);
    } catch (ex) {
      setMsg("Error saving");
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-lg border border-slate-200 px-3 py-1 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-900">
        Settings
      </button>
    );
  }

  return (
    <form onSubmit={save} className="mt-4 flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
      <div className="flex justify-between">
        <h3 className="font-semibold text-slate-700 dark:text-slate-300">WhatsApp Settings</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-slate-400">✕</button>
      </div>
      <div>
        <label className="text-xs text-slate-500">Business WhatsApp Number (incl. country code, e.g. 919999999999)</label>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm dark:border-slate-700 dark:bg-slate-950"
            value={wa}
            onChange={(e) => setWa(e.target.value)}
            placeholder="91xxxxxxxxxx"
          />
          <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-1 text-sm font-semibold text-white">Save</button>
        </div>
      </div>
      {msg && <p className="text-xs text-brand">{msg}</p>}
    </form>
  );
}

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

  function handleUpdate(updatedCanteen) {
    setRows(rows.map(r => r.id === updatedCanteen.id ? updatedCanteen : r));
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
          <div key={c.id} className="card flex flex-col justify-between space-y-3">
            <div>
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-semibold">{c.name}</h2>
                  <p className="text-xs text-slate-500">slug: {c.slug}</p>
                </div>
              </div>
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
              <CanteenSettings canteen={c} onUpdate={handleUpdate} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
