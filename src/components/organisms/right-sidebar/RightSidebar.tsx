"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "@/components/atoms/IconButton";
import { cn } from "@/lib/utils";

export type RightSidebarTab = {
  id: string;
  label: string;
  icon: LucideIcon;
  hasUnread?: boolean;
  render?: () => React.ReactNode;
};

type RightSidebarRailProps = {
  tabs: RightSidebarTab[];
  activeTabId: string;
  onTabSelect: (tabId: string) => void;
  isCollapsed?: boolean;
  onRequestExpand?: () => void;
  onRequestCollapse?: () => void;
};

type RightSidebarContentProps = {
  tabs: RightSidebarTab[];
  activeTabId: string;
};

const ComingSoonPanel = ({ label }: { label: string }) => (
  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
    {label} coming soon
  </div>
);

export const RightSidebarRail: React.FC<RightSidebarRailProps> = ({
  tabs,
  activeTabId,
  onTabSelect,
  isCollapsed = false,
  onRequestExpand,
  onRequestCollapse,
}) => {
  if (tabs.length === 0) {
    return null;
  }

  const handleToggleCollapse = () => {
    if (isCollapsed) {
      onRequestExpand?.();
      return;
    }
    onRequestCollapse?.();
  };

  return (
    <div className="flex w-12 shrink-0 flex-col items-center gap-2 border-l bg-background/95 py-2">
      <div
        className="flex flex-1 flex-col items-center gap-2"
        role="tablist"
        aria-orientation="vertical"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <IconButton
              key={tab.id}
              aria-label={tab.label}
              title={tab.label}
              role="tab"
              aria-selected={isActive}
              className={cn(
                "h-9 w-9 rounded-md p-0 text-muted-foreground",
                isActive && "bg-muted text-foreground",
              )}
              onClick={() => onTabSelect(tab.id)}
            >
              <span className="relative inline-flex">
                <tab.icon className="h-6 w-6" />
                {tab.hasUnread ? (
                  <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500" />
                ) : null}
              </span>
            </IconButton>
          );
        })}
      </div>
      {onRequestCollapse && onRequestExpand && (
        <IconButton
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="h-9 w-9 rounded-md text-muted-foreground"
          onClick={handleToggleCollapse}
        >
          {isCollapsed ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </IconButton>
      )}
    </div>
  );
};

export const RightSidebarContent: React.FC<RightSidebarContentProps> = ({
  tabs,
  activeTabId,
}) => {
  if (tabs.length === 0) {
    return null;
  }

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  return (
    <div className="h-full min-h-0">
      {activeTab.render ? (
        activeTab.render()
      ) : (
        <ComingSoonPanel label={activeTab.label} />
      )}
    </div>
  );
};
