import { useEffect, useState } from "react";
import { Routes, Route, Link, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { useNotifications } from "./context/NotificationContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import OwnerHome from "./pages/OwnerHome";
import OwnerStaff from "./pages/OwnerStaff";
import MenuEditor from "./pages/MenuEditor";
import Counter from "./pages/Counter";
import GuestMenu from "./pages/GuestMenu";
import MyOrders from "./pages/MyOrders";
import CustomerDashboard from "./pages/CustomerDashboard";
import CookBoard from "./pages/CookBoard";
import ServerBoard from "./pages/ServerBoard";
import Analytics from "./pages/Analytics";
import Forecast from "./pages/Forecast";
import QrPage from "./pages/QrPage";

function Shell({ children }) {
  const { user, logout } = useAuth();
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");
  const { items, clear } = useNotifications();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="text-lg font-bold text-brand">
            Canteen OS
          </Link>
          <nav className="relative flex flex-wrap items-center gap-3 text-sm">
            <Link className="hover:text-brand" to="/">
              Discover
            </Link>
            {user?.role === "customer" && (
              <Link className="hover:text-brand" to="/customer">
                Customer
              </Link>
            )}
            {user?.role === "customer" && (
              <Link className="hover:text-brand" to="/my-orders">
                My orders
              </Link>
            )}
            {user?.role === "owner" && (
              <Link className="hover:text-brand" to="/owner">
                Owner
              </Link>
            )}
            {user?.role === "cook" && (
              <Link className="hover:text-brand" to="/cook">
                Kitchen
              </Link>
            )}
            {user?.role === "server" && (
              <Link className="hover:text-brand" to="/server">
                Serve
              </Link>
            )}
            {user?.role === "customer" && (
              <div className="relative">
                <button
                  type="button"
                  className="relative h-8 w-8 rounded-full border border-slate-300 dark:border-slate-700"
                  onClick={() => setOpen((o) => !o)}
                >
                  <span className="absolute inset-0 flex items-center justify-center text-xs">🔔</span>
                  {items.length > 0 && (
                    <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-emerald-500" />
                  )}
                </button>
                {open && (
                  <div className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-semibold">Notifications</span>
                      {items.length > 0 && (
                        <button
                          type="button"
                          className="text-[10px] text-slate-500 hover:underline"
                          onClick={() => clear()}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {items.length === 0 ? (
                      <p className="text-slate-500">No notifications yet.</p>
                    ) : (
                      <ul className="space-y-1 max-h-48 overflow-y-auto">
                        {items.map((n) => (
                          <li key={n.id} className="rounded bg-slate-50 px-2 py-1 dark:bg-slate-800">
                            {n.text}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-2 py-1 text-xs dark:border-slate-700"
              onClick={() => setDark((d) => !d)}
            >
              {dark ? "Light" : "Dark"}
            </button>
            {user ? (
              <button type="button" className="text-rose-600 hover:underline" onClick={logout}>
                Log out ({user.name})
              </button>
            ) : (
              <>
                <Link className="hover:text-brand" to="/login">
                  Login
                </Link>
                <Link className="hover:text-brand" to="/register">
                  Register
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}

function Private({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="text-center text-slate-500">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/menu/:slug" element={<GuestMenu />} />

        <Route
          path="/owner"
          element={
            <Private role="owner">
              <OwnerHome />
            </Private>
          }
        />
        <Route
          path="/owner/:id/menu"
          element={
            <Private role="owner">
              <MenuEditor />
            </Private>
          }
        />
        <Route
          path="/owner/:id/staff"
          element={
            <Private role="owner">
              <OwnerStaff />
            </Private>
          }
        />
        <Route
          path="/owner/:id/counter"
          element={
            <Private role="owner">
              <Counter />
            </Private>
          }
        />
        <Route
          path="/owner/:id/analytics"
          element={
            <Private role="owner">
              <Analytics />
            </Private>
          }
        />
        <Route
          path="/owner/:id/forecast"
          element={
            <Private role="owner">
              <Forecast />
            </Private>
          }
        />
        <Route
          path="/owner/:id/qr"
          element={
            <Private role="owner">
              <QrPage />
            </Private>
          }
        />

        <Route
          path="/customer"
          element={
            <Private role="customer">
              <CustomerDashboard />
            </Private>
          }
        />

        <Route
          path="/my-orders"
          element={
            <Private role="customer">
              <MyOrders />
            </Private>
          }
        />

        <Route
          path="/cook"
          element={
            <Private role="cook">
              <CookBoard />
            </Private>
          }
        />
        <Route
          path="/server"
          element={
            <Private role="server">
              <ServerBoard />
            </Private>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
