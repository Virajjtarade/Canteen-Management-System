import { useEffect, useState } from "react";
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

export default function MenuEditor() {
  const { id } = useParams();
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [err, setErr] = useState("");

  function load() {
    api
      .get(`/menu/canteen/${id}`)
      .then((r) => setItems(r.data))
      .catch((e) => setErr(e.response?.data?.error || "Failed"));
  }

  useEffect(() => {
    load();
  }, [id]);

  async function add(e) {
    e.preventDefault();
    setErr("");
    try {
      await api.post(`/menu/canteen/${id}`, {
        name,
        price: Number(price),
        image_url: imageUrl,
      });
      setName("");
      setPrice("");
      setImageUrl("");
      load();
    } catch (ex) {
      setErr(ex.response?.data?.error || "Could not add");
    }
  }

  async function toggle(it) {
    await api.patch(`/menu/item/${it.id}`, { available: !it.available });
    load();
  }

  async function remove(it) {
    if (!confirm(`Delete ${it.name}?`)) return;
    await api.delete(`/menu/item/${it.id}`);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Menu</h1>
        <Link className="text-sm text-brand hover:underline" to="/owner">
          ← Back
        </Link>
      </div>
      <form onSubmit={add} className="card grid gap-3 md:grid-cols-4">
        <div className="md:col-span-2">
          <label className="text-sm text-slate-600 dark:text-slate-400">Name</label>
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-sm text-slate-600 dark:text-slate-400">Price</label>
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-sm text-slate-600 dark:text-slate-400">Image URL</label>
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://…"
          />
        </div>
        <div className="md:col-span-4">
          <button type="submit" className="rounded-xl bg-brand px-4 py-2 font-semibold text-white">
            Add item
          </button>
        </div>
      </form>
      {err && <p className="text-sm text-rose-600">{err}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((it) => (
          <div key={it.id} className="card flex items-start justify-between gap-3 transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start gap-3">
              {(() => {
                const icon = itemIcon(it.name);
                return (
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${icon.className}`}>
                    <span className="text-sm font-bold">{icon.initial}</span>
                  </div>
                );
              })()}
              <div>
                <p className="font-semibold">{it.name}</p>
                <p className="text-sm text-slate-500">₹{Number(it.price).toFixed(2)}</p>
                <p className="text-xs text-slate-400">{it.available ? "Available" : "Hidden"}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <button type="button" className="rounded-lg border border-slate-300 px-2 py-1 dark:border-slate-600" onClick={() => toggle(it)}>
                Toggle
              </button>
              <button type="button" className="text-rose-600" onClick={() => remove(it)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
