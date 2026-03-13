"use client";

import * as React from "react";
import { Panel } from "@/components/atoms/Panel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export type SidebarAlertItem = {
  id: string;
  title: string;
  symbol: string;
  status: string;
  time: string;
  accent?: string;
};

export const AlertsPanel: React.FC<{ items: SidebarAlertItem[] }> = ({
  items,
}) => (
  <Panel className="h-full min-h-0 flex flex-col">
    <div className="border-b px-3 py-2">
      <div className="text-sm font-semibold">Alerts</div>
      <div className="text-xs text-muted-foreground">
        Triggered alerts (latest first)
      </div>
    </div>
    <ScrollArea className="flex-1">
      <div className="px-3 py-2">
        {items.length === 0 ? (
          <div className="py-4 text-xs text-muted-foreground">
            No alerts yet.
          </div>
        ) : null}
        {items.map((item, index) => (
          <React.Fragment key={item.id}>
            <div className="space-y-1 py-2">
              <div className="text-sm font-medium">{item.title}</div>
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">{item.symbol}</span>
                <span className="px-1">•</span>
                <span className={item.accent ?? "text-amber-500"}>
                  {item.status}
                </span>
                <span className="px-1">•</span>
                <span>{item.time}</span>
              </div>
            </div>
            {index < items.length - 1 && <Separator />}
          </React.Fragment>
        ))}
      </div>
    </ScrollArea>
  </Panel>
);
