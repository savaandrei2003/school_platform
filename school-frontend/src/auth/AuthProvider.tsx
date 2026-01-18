import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { keycloak } from "./keycloak";

type AuthCtx = {
  ready: boolean;
  authenticated: boolean;
  token: string | null;
  login: () => void;
  logout: () => void;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    keycloak
      .init({
        onLoad: "check-sso", 
        pkceMethod: "S256",
        checkLoginIframe: false,
      })
      .then((auth) => {
        setAuthenticated(auth);
        setToken(keycloak.token ?? null);
        setReady(true);
      });

    const id = window.setInterval(async () => {
      if (!keycloak.authenticated) return;
      try {
        const refreshed = await keycloak.updateToken(30);
        if (refreshed) setToken(keycloak.token ?? null);
      } catch {
        setAuthenticated(false);
        setToken(null);
      }
    }, 10_000);

    return () => window.clearInterval(id);
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      ready,
      authenticated,
      token,
      login: () => keycloak.login(),
      logout: () => keycloak.logout({ redirectUri: window.location.origin }),
    }),
    [ready, authenticated, token],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
