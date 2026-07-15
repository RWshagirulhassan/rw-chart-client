"use client";

import * as React from "react";
import { Watchlist } from "@/components/organisms/Watchlist";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

import { TradingChartPanel } from "@/components/organisms/trading/TradingChartPanel";
import { backendFetch } from "@/lib/runtimeConfig";
import type { ChartRouteInstrument } from "../chart/chartDomainTypes";
import { useAuthSession } from "../auth/AuthContext";

export const TradingLayout: React.FC<{ instrument: ChartRouteInstrument }> = ({
  instrument,
}) => {
  const { session, requestRefresh } = useAuthSession();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const [isDesktop, setIsDesktop] = React.useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(min-width: 1024px)").matches;
  });

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(min-width: 1024px)");
    const handleChange = (event: MediaQueryListEvent) => {
      setIsDesktop(event.matches);
    };

    setIsDesktop(media.matches);
    if (media.addEventListener) {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  const handleLogout = React.useCallback(async () => {
    try {
      setIsLoggingOut(true);
      await backendFetch("/kite/logout", { method: "POST" });
    } finally {
      requestRefresh();
      setIsLoggingOut(false);
    }
  }, [requestRefresh]);

  return (
    <div className="h-screen w-full overflow-hidden bg-background">
      <header className="h-10 border-b px-3 flex items-center justify-between">
        <div className="text-sm font-medium">Chart</div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="rounded-none">
            Connected
          </Badge>
          <span className="text-xs text-muted-foreground">
            {session?.userId || "unknown-user"}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="rounded-none"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? "Logging out..." : "Logout"}
          </Button>
        </div>
      </header>

      <div className="h-[calc(100vh-2.5rem)] p-3 min-h-0">
        {isDesktop ? (
          <div className="flex h-full min-h-0">
            <ResizablePanelGroup
              direction="horizontal"
              className="h-full min-h-0 flex-1"
            >
              <ResizablePanel defaultSize={76} minSize={55} order={1}>
                <TradingChartPanel
                  instrument={instrument}
                  panelClassName="h-full min-h-0 border-0 overflow-hidden"
                  cardClassName="m-0 rounded-none h-full flex flex-col overflow-hidden"
                  cardContentClassName="flex-1 min-h-0 flex flex-col rounded-none"
                  chartWrapperClassName="chartWrap"
                />
              </ResizablePanel>
              <ResizablePanel
                defaultSize={24}
                minSize={18}
                maxSize={35}
                order={2}
              >
                <div className="h-full min-h-0 border border-border bg-card">
                  <div className="border-b px-3 py-2 text-sm font-medium">
                    Watchlist
                  </div>
                  <div className="h-[calc(100%-41px)] min-h-0">
                    <Watchlist />
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        ) : (
          <div className="grid grid-cols-1 grid-rows-[auto,1fr] gap-3 h-full min-h-0">
            <div className="min-h-0">
              <Watchlist />
            </div>

            <TradingChartPanel
              instrument={instrument}
            />
          </div>
        )}
      </div>
    </div>
  );
};
