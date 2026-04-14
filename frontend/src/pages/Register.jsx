import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const nav = useNavigate();
  const { login } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("customer");
  const [canteenName, setCanteenName] = useState("");
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    setErr("");
    try {
      const body = { name, email, password, role, canteen_name: canteenName };
      const { data } = await api.post("/auth/register", body);
      login(data.access_token, data.user);
      if (data.user.role === "owner") nav("/owner");
      else nav("/");
    } catch (ex) {
      setErr(ex.response?.data?.error || "Registration failed");
    }
  }

  return (
    <div className="mx-auto max-w-md card">
      <h1 className="text-2xl font-bold">Create account</h1>
      <form className="mt-4 space-y-3" onSubmit={submit}>
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
          <label className="text-sm text-slate-600 dark:text-slate-400">Email</label>
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-sm text-slate-600 dark:text-slate-400">Password</label>
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
            <option value="customer">Customer</option>
            <option value="owner">Canteen owner (creates your canteen)</option>
          </select>
        </div>
        {role === "owner" && (
          <div>
            <label className="text-sm text-slate-600 dark:text-slate-400">Canteen display name</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              value={canteenName}
              onChange={(e) => setCanteenName(e.target.value)}
              placeholder="e.g. Campus Food Court"
            />
          </div>
        )}
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <button
          type="submit"
          className="w-full rounded-xl bg-brand py-2 font-semibold text-white hover:bg-brand-dark"
        >
          Register
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
        Have an account? <Link className="text-brand hover:underline" to="/login">Login</Link>
      </p>
    </div>
  );
}
