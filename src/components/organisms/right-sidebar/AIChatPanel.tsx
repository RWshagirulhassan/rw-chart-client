"use client";

import * as React from "react";
import {
  BarChart3,
  BookOpen,
  ChevronDown,
  Sparkles,
  Plus,
  Send,
  SlidersHorizontal,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { IconButton } from "@/components/atoms/IconButton";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: React.ReactNode;
  timestamp: string;
};

type ModeOption = {
  id: "backtest" | "indicator" | "strategy" | "study";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const modelOptions = [
  "ChatGPT 5.2 Instant",
  "ChatGPT 5.2 Pro",
  "ChatGPT 4.1",
];

const modeOptions: ModeOption[] = [
  { id: "backtest", label: "Backtest", icon: BarChart3 },
  { id: "indicator", label: "Indicator", icon: SlidersHorizontal },
  { id: "strategy", label: "Strategy", icon: Target },
  { id: "study", label: "Study", icon: BookOpen },
];

const initialMessages: ChatMessage[] = [
  {
    id: "msg-1",
    role: "user",
    content: "What is the VIX for NIFTY 50?",
    timestamp: "09:32",
  },
  {
    id: "msg-2",
    role: "assistant",
    content: (
      <div className="space-y-3">
        <p>
          <strong>India VIX</strong> is the volatility gauge for the NIFTY 50. It
          reflects the market&apos;s expectation of volatility over the next 30 days
          based on NIFTY options pricing.
        </p>
        <ul className="list-disc space-y-1 pl-4">
          <li>
            <strong>Higher values</strong> indicate rising uncertainty.
          </li>
          <li>
            <strong>Lower values</strong> suggest calmer market conditions.
          </li>
        </ul>
        <p className="text-xs text-muted-foreground">
          Source: NSE India / public market feeds.
        </p>
      </div>
    ),
    timestamp: "09:33",
  },
];

export const AIChatPanel: React.FC = () => {
  const [selectedModel, setSelectedModel] = React.useState(modelOptions[0]);
  const [activeModes, setActiveModes] = React.useState<Set<ModeOption["id"]>>(
    () => new Set(["indicator"])
  );
  const [modeSelectKey, setModeSelectKey] = React.useState(0);
  const hasActiveModes = activeModes.size > 0;

  const activeModeOptions = React.useMemo(
    () => modeOptions.filter((mode) => activeModes.has(mode.id)),
    [activeModes]
  );

  const toggleMode = (modeId: ModeOption["id"], isActive: boolean) => {
    setActiveModes((prev) => {
      const next = new Set(prev);
      if (isActive) {
        next.add(modeId);
      } else {
        next.delete(modeId);
      }
      return next;
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-background px-3 py-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-8 gap-2 px-2 text-sm"
              aria-label="Select AI model"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="truncate">{selectedModel}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Models</DropdownMenuLabel>
            <DropdownMenuGroup>
              {modelOptions.map((model) => (
                <DropdownMenuCheckboxItem
                  key={model}
                  checked={selectedModel === model}
                  onCheckedChange={() => setSelectedModel(model)}
                >
                  {model}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1 px-2 py-1 text-xs">
            <span className="text-muted-foreground">Stock</span>
            NIFTY 50
          </Badge>
          {activeModes.size > 0 && (
            <div className="hidden flex-wrap items-center gap-1 text-xs text-muted-foreground sm:flex">
              {Array.from(activeModes).map((mode) => (
                <Badge key={mode} variant="outline" className="capitalize">
                  {mode}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-4 px-3 py-4">
          {initialMessages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex w-full",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                )}
              >
                <div
                  className={cn(
                    message.role === "assistant" &&
                      "prose prose-sm max-w-none dark:prose-invert"
                  )}
                >
                  {message.content}
                </div>
                <div
                  className={cn(
                    "mt-1 text-[11px] opacity-70",
                    message.role === "user"
                      ? "text-primary-foreground/70"
                      : "text-muted-foreground"
                  )}
                >
                  {message.timestamp}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="border-t bg-background p-3">
        <div
          className={cn(
            "flex w-full gap-2 bg-muted/40 px-3 py-2",
            hasActiveModes
              ? "flex-col rounded-2xl"
              : "items-center rounded-full"
          )}
        >
          <div
            className={cn(
              "flex w-full items-center gap-2",
              hasActiveModes ? "justify-between" : "justify-start"
            )}
          >
            {!hasActiveModes && (
              <>
                <Select
                  key={modeSelectKey}
                  onValueChange={(value: ModeOption["id"]) => {
                    toggleMode(value, true);
                    setModeSelectKey((prev) => prev + 1);
                  }}
                >
                  <SelectTrigger
                    aria-label="Select mode"
                    className="h-9 w-9 justify-center border-0 bg-transparent p-0 shadow-none"
                  >
                    <Plus className="h-4 w-4" />
                  </SelectTrigger>
                  <SelectContent>
                    {modeOptions.map((mode) => (
                      <SelectItem key={mode.id} value={mode.id}>
                        <span className="flex items-center gap-2">
                          <mode.icon className="h-4 w-4" />
                          {mode.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Ask anything about NIFTY 50..."
                  className="h-9 flex-1 rounded-full border-transparent bg-transparent px-0 pl-1 pr-10 shadow-none outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <Button
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </>
            )}
            {hasActiveModes && (
              <>
                <Input
                  placeholder="Ask anything about NIFTY 50..."
                  className="h-9 w-full rounded-full border-transparent bg-transparent px-0 pl-1 pr-10 shadow-none outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </>
            )}
          </div>
          {hasActiveModes && (
            <div className="flex w-full items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  key={modeSelectKey}
                  onValueChange={(value: ModeOption["id"]) => {
                    toggleMode(value, true);
                    setModeSelectKey((prev) => prev + 1);
                  }}
                >
                  <SelectTrigger
                    aria-label="Select mode"
                    className="h-9 w-9 justify-center border-0 bg-transparent p-0 shadow-none"
                  >
                    <Plus className="h-4 w-4" />
                  </SelectTrigger>
                  <SelectContent>
                    {modeOptions.map((mode) => (
                      <SelectItem key={mode.id} value={mode.id}>
                        <span className="flex items-center gap-2">
                          <mode.icon className="h-4 w-4" />
                          {mode.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap items-center gap-1">
                  {activeModeOptions.map((mode) => (
                    <Badge
                      key={mode.id}
                      variant="secondary"
                      className="group flex items-center gap-1 pr-1 text-xs"
                    >
                      <mode.icon className="h-3.5 w-3.5" />
                      {mode.label}
                      <button
                        type="button"
                        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-foreground"
                        aria-label={`Remove ${mode.label} mode`}
                        onClick={() => toggleMode(mode.id, false)}
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
              <Button
                size="icon"
                className="h-8 w-8 rounded-full"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
