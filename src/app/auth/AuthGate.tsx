import * as React from "react";
import { Button } from "@/components/ui/button";
import { resolveBackendHref } from "@/lib/runtimeConfig";
import { fetchAuthSession } from "./authApi";
import { useAuthSession } from "./AuthContext";
import { isAuthenticated } from "./authTypes";

type GateStatus = "loading" | "error" | "unauthenticated" | "authenticated";

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, setSession, refreshToken, requestRefresh } = useAuthSession();
  const [status, setStatus] = React.useState<GateStatus>("loading");
  const [error, setError] = React.useState<string>("");

  React.useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      setStatus("loading");
      setError("");
      try {
        const next = await fetchAuthSession();
        if (!mounted) {
          return;
        }
        setSession(next);
        setStatus(isAuthenticated(next) ? "authenticated" : "unauthenticated");
      } catch (e) {
        if (!mounted) {
          return;
        }
        setSession(null);
        setStatus("error");
        setError(e instanceof Error ? e.message : "Unable to verify auth session");
      }
    }

    checkAuth();
    return () => {
      mounted = false;
    };
  }, [refreshToken, setSession]);

  if (status === "loading") {
    return (
      <div className="h-screen w-full bg-background text-foreground flex items-center justify-center p-6 text-center">
        <div>
          <div className="text-lg font-semibold">Checking authentication</div>
          <div className="text-sm text-muted-foreground mt-2">Please wait...</div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="h-screen w-full bg-background text-foreground flex items-center justify-center p-6">
        <div className="w-full max-w-md border bg-card text-card-foreground p-6 space-y-4">
          <div className="text-lg font-semibold">Auth check failed</div>
          <p className="text-sm text-muted-foreground">{error}</p>
          <div className="flex justify-end">
            <Button onClick={requestRefresh}>Retry</Button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    const loginHref = session?.loginUrl || resolveBackendHref("/kite/login");
    return (
      <div className="h-screen w-full bg-background text-foreground flex items-center justify-center p-6">
        <div className="w-full max-w-md border bg-card text-card-foreground p-6 space-y-4 text-center">
          <div className="text-xl font-semibold">Login Required</div>
          <p className="text-sm text-muted-foreground">
            Complete login in the opened tab, then refresh auth here.
          </p>
          <div className="flex flex-col gap-2">
            <Button asChild>
              <a href={loginHref} target="_blank" rel="noreferrer">
                Login to Kite
              </a>
            </Button>
            <Button variant="outline" onClick={requestRefresh}>
              I&apos;ve logged in
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
