import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { MenuForDate } from "./pages/MenuForDate";
import type { JSX } from "react";
import { Profile } from "./pages/Profile";
import { OrdersCalendar } from "./pages/OrdersCalendar";
import { AppLayout } from "./components/layout/AppLayout";

function RequireAuth({ children }: { children: JSX.Element }) {
  const { ready, authenticated } = useAuth();
  if (!ready) return <div style={{ padding: 24 }}>Loading…</div>;
  if (!authenticated) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/menus/:date"
            element={
              <RequireAuth>
                <MenuForDate />
              </RequireAuth>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <Profile />
              </RequireAuth>
            }
          />
          <Route
            path="/calendar"
            element={
              <RequireAuth>
                <OrdersCalendar />
              </RequireAuth>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
