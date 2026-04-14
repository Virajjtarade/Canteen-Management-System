import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const nav = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    setErr("");
    try {
      const { data } = await api.post("/auth/login", { email, password });
      login(data.access_token, data.user);
      if (data.user.role === "owner") nav("/owner");
      else if (data.user.role === "cook") nav("/cook");
      else if (data.user.role === "server") nav("/server");
      else if (data.user.role === "customer") nav("/customer");
      else nav("/");
    } catch (ex) {
      setErr(ex.response?.data?.error || "Login failed");
    }
  }

  return (
    <div className="mx-auto max-w-md card">
      <h1 className="text-2xl font-bold">Login</h1>
      <form className="mt-4 space-y-3" onSubmit={submit}>
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
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <button
          type="submit"
          className="w-full rounded-xl bg-brand py-2 font-semibold text-white hover:bg-brand-dark"
        >
          Sign in
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
        No account? <Link className="text-brand hover:underline" to="/register">Register</Link>
      </p>
    </div>
  );
}
