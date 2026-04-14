import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";

export default function OwnerStaff() {
  const { id } = useParams();
  const cid = Number(id);

  const [staff, setStaff] = useState([]);
  const [err, setErr] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("cook");
  const [savingId, setSavingId] = useState(null);

  function load() {
    setErr("");
    api
      .get(`/canteens/${cid}/staff`)
      .then((r) => setStaff(r.data))
      .catch((e) => setErr(e.response?.data?.error || "Failed to load staff"));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cid]);

  async function add(e) {
    e.preventDefault();
    setErr("");
    try {
      await api.post(`/canteens/${cid}/staff`, {
        name,
        email,
        password,
        role,
      });
      setName("");
      setEmail("");
      setPassword("");
      setRole("cook");
      load();
    } catch (ex) {
      setErr(ex.response?.data?.error || "Could not add staff");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Staff management</h1>
        <Link className="text-sm text-brand hover:underline" to="/owner">
          ← Back
        </Link>
      </div>

      <div className="card space-y-4">
        <h2 className="text-xl font-semibold">Add cook / server</h2>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={add}>
          <div>
            <label className="text-sm text-slate-600 dark:text-slate-400">Name</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm text-slate-600 dark:text-slate-400">Role</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="cook">Cook</option>
              <option value="server">Server</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-sm text-slate-600 dark:text-slate-400">Email</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm text-slate-600 dark:text-slate-400">Password</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="md:col-span-2 flex items-center gap-3">
            <button type="submit" className="rounded-xl bg-brand px-4 py-2 font-semibold text-white">
              Add staff
            </button>
            <button type="button" className="rounded-xl border border-slate-300 px-4 py-2 text-sm dark:border-slate-700" onClick={load}>
              Refresh
            </button>
          </div>
        </form>
        {err && <p className="text-sm text-rose-600">{err}</p>}
      </div>

      <div className="card space-y-3">
        <h2 className="text-xl font-semibold">Current staff (canteen #{cid})</h2>
        {staff.length === 0 ? (
          <p className="text-sm text-slate-500">No cooks/servers yet.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {staff.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand font-bold">
                    {(u.name || "?").slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold">{u.name}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 text-xs">
                  <select
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
                    value={u.role}
                    onChange={async (e) => {
                      const nextRole = e.target.value;
                      setSavingId(u.id);
                      try {
                        await api.patch(`/canteens/${cid}/staff/${u.id}`, { role: nextRole });
                        setStaff((prev) =>
                          prev.map((s) => (s.id === u.id ? { ...s, role: nextRole } : s))
                        );
                      } catch (ex) {
                        setErr(ex.response?.data?.error || "Could not update role");
                      } finally {
                        setSavingId(null);
                      }
                    }}
                  >
                    <option value="cook">Cook</option>
                    <option value="server">Server</option>
                  </select>
                  {savingId === u.id && <span className="text-[10px] text-slate-400">Saving…</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

