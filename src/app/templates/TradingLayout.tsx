"use client";

import * as React from "react";
import { Watchlist } from "@/components/organisms/Watchlist";
import {
  AlertsPanel,
  type SidebarAlertItem,
} from "@/components/organisms/right-sidebar/AlertsPanel";
// import { AIChatPanel } from "@/components/organisms/right-sidebar/AIChatPanel";
import { SignalsPanel } from "@/components/organisms/right-sidebar/SignalsPanel";
import {
  RightSidebarContent,
  RightSidebarRail,
} from "@/components/organisms/right-sidebar/RightSidebar";
import { Activity, Bookmark, Clock } from "lucide-react";
// import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import type { ImperativePanelHandle } from "react-resizable-panels";

import { TradingAccountPanel } from "@/components/organisms/trading/TradingAccountPanel";
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
  const [alerts, setAlerts] = React.useState<SidebarAlertItem[]>([]);
  const [hasUnreadAlerts, setHasUnreadAlerts] = React.useState(false);
  const [activeRightTab, setActiveRightTab] = React.useState("watchlist");
  const rightSidebarTabs = React.useMemo(
    () => [
      // Add new tabs here (icon + render). Tabs without render will show a
      // "Coming soon" placeholder automatically.
      {
        id: "watchlist",
        label: "Watchlist",
        icon: Bookmark,
        render: () => <Watchlist />,
      },
      {
        id: "alerts",
        label: "Alerts",
        icon: Clock,
        hasUnread: hasUnreadAlerts,
        render: () => <AlertsPanel items={alerts} />,
      },
      {
        id: "signals",
        label: "Signals",
        icon: Activity,
        render: () => <SignalsPanel />,
      },
      // {
      //   id: "ai-chat",
      //   label: "AI Chat",
      //   icon: Sparkles,
      //   render: () => <AIChatPanel />,
      // },
    ],
    [alerts, hasUnreadAlerts],
  );
  const rightPanelRef = React.useRef<ImperativePanelHandle>(null);
  const [isRightCollapsed, setIsRightCollapsed] = React.useState(false);
  const rightCollapsedSize = 0;
  const rightExpandedSize = 24;

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

  const handleRightResize = React.useCallback(
    (size: number) => {
      setIsRightCollapsed(size <= rightCollapsedSize);
    },
    [rightCollapsedSize],
  );

  const expandRightPanel = React.useCallback(() => {
    rightPanelRef.current?.resize(rightExpandedSize);
  }, [rightExpandedSize]);

  const collapseRightPanel = React.useCallback(() => {
    rightPanelRef.current?.resize(rightCollapsedSize);
  }, [rightCollapsedSize]);

  const handleAlertTriggered = React.useCallback(
    (message: string) => {
      const now = new Date();
      const nextAlert: SidebarAlertItem = {
        id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
        title: message,
        symbol: instrument.tradingsymbol,
        status: "Triggered",
        time: now.toLocaleString(),
        accent: "text-red-500",
      };
      setAlerts((current) => [nextAlert, ...current].slice(0, 500));
      if (activeRightTab !== "alerts" || isRightCollapsed) {
        setHasUnreadAlerts(true);
      }
    },
    [activeRightTab, instrument.tradingsymbol, isRightCollapsed],
  );

  const handleRightTabSelect = React.useCallback(
    (tabId: string) => {
      setActiveRightTab(tabId);
      if (isRightCollapsed) {
        expandRightPanel();
      }
      if (tabId === "alerts") {
        setHasUnreadAlerts(false);
      }
    },
    [expandRightPanel, isRightCollapsed],
  );

  React.useEffect(() => {
    if (activeRightTab === "alerts" && !isRightCollapsed) {
      setHasUnreadAlerts(false);
    }
  }, [activeRightTab, isRightCollapsed]);

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
                <ResizablePanelGroup
                  direction="vertical"
                  className="h-full min-h-0"
                >
                  <ResizablePanel defaultSize={60} minSize={6}>
                    <TradingChartPanel
                      instrument={instrument}
                      onAlertTriggered={handleAlertTriggered}
                      panelClassName="h-full min-h-0 border-0 overflow-hidden"
                      cardClassName="m-0 rounded-none h-full flex flex-col overflow-hidden"
                      cardContentClassName="flex-1 min-h-0 flex flex-col rounded-none"
                      chartWrapperClassName="chartWrap"
                    />
                  </ResizablePanel>

                  <ResizableHandle className="my-0.5" />

                  <ResizablePanel defaultSize={5} minSize={10}>
                    <div className="h-full min-h-0 overflow-hidden">
                      <TradingAccountPanel />
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </ResizablePanel>
              <ResizableHandle className="mx-0.5" />
              <ResizablePanel
                ref={rightPanelRef}
                defaultSize={rightExpandedSize}
                minSize={rightCollapsedSize}
                maxSize={40}
                onResize={handleRightResize}
                order={2}
              >
                <div className="h-full min-h-0 pr-3">
                  {!isRightCollapsed && (
                    <RightSidebarContent
                      tabs={rightSidebarTabs}
                      activeTabId={activeRightTab}
                    />
                  )}
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
            <RightSidebarRail
              tabs={rightSidebarTabs}
              activeTabId={activeRightTab}
              onTabSelect={handleRightTabSelect}
              isCollapsed={isRightCollapsed}
              onRequestExpand={expandRightPanel}
              onRequestCollapse={collapseRightPanel}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 grid-rows-[auto,1fr] gap-3 h-full min-h-0">
            <div className="min-h-0">
              <Watchlist />
            </div>

            <TradingChartPanel
              instrument={instrument}
              onAlertTriggered={handleAlertTriggered}
            />
          </div>
        )}
      </div>
    </div>
  );
};
