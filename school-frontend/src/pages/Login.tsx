import { useAuth } from "../auth/AuthProvider";

export function Login() {
  const { ready, authenticated, login, logout } = useAuth();

  if (!ready) return <div style={{ padding: 24 }}>Loading…</div>;

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h2>School Platform</h2>
      <p>Minimal frontend (Keycloak + Orders + Menus)</p>

      {!authenticated ? (
        <button onClick={login}>Login with Keycloak</button>
      ) : (
        <button onClick={logout}>Logout</button>
      )}
    </div>
  );
}
