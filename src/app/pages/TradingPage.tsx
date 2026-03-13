import * as React from "react";
import type { ChartRouteInstrument } from "../chart/chartDomainTypes";
import { TradingLayout } from "../templates/TradingLayout";

function parseChartRoute(pathname: string): ChartRouteInstrument | null {
  const match = pathname.match(/^\/chart\/([^/]+)\/([^/]+)\/([^/]+)\/?$/);
  if (!match) {
    return null;
  }
  const [, exchange, tradingsymbol, instrumentToken] = match;
  if (!exchange || !tradingsymbol || !instrumentToken) {
    return null;
  }
  return {
    exchange: decodeURIComponent(exchange),
    tradingsymbol: decodeURIComponent(tradingsymbol),
    instrumentToken: decodeURIComponent(instrumentToken),
  };
}

export default function TradingPage() {
  const [pathname, setPathname] = React.useState(() =>
    typeof window === "undefined"
      ? "/chart/MCX-FUT/NATURALGAS26MARFUT/121628423"
      : window.location.pathname,
  );

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (window.location.pathname === "/") {
      const fallback = "/chart/MCX-FUT/NATURALGAS26MARFUT/121628423";
      window.history.replaceState({}, "", fallback);
      setPathname(fallback);
    }
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const instrument = React.useMemo(() => parseChartRoute(pathname), [pathname]);

  if (!instrument) {
    return (
      <div className="h-screen w-full bg-background text-foreground flex items-center justify-center p-6 text-center">
        <div>
          <div className="text-lg font-semibold">Invalid route</div>
          <div className="text-sm text-muted-foreground mt-2">
            Use <code>/chart/NSE/TCS/2953217</code>
          </div>
        </div>
      </div>
    );
  }

  return <TradingLayout instrument={instrument} />;
}
