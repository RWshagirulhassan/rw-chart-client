"use client";

import * as React from "react";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const HoverCard = ({
  children,
  openDelay = 200,
  closeDelay = 100,
}: React.PropsWithChildren<{ openDelay?: number; closeDelay?: number }>) => {
  const [open, setOpen] = React.useState(false);
  const openTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleOpen = (next: boolean) => {
    if (next) {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      openTimer.current = setTimeout(() => setOpen(true), openDelay);
    } else {
      if (openTimer.current) clearTimeout(openTimer.current);
      closeTimer.current = setTimeout(() => setOpen(false), closeDelay);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div onMouseEnter={() => handleOpen(true)} onMouseLeave={() => handleOpen(false)}>
        {children}
      </div>
    </Popover>
  );
};

const HoverCardTrigger = ({ children }: React.PropsWithChildren) => <>{children}</>;

const HoverCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <PopoverContent
    ref={ref}
    className={cn(
      "z-50 w-72 rounded-md border bg-popover p-3 text-popover-foreground shadow-md outline-none",
      className
    )}
    {...props}
  />
));
HoverCardContent.displayName = "HoverCardContent";

export { HoverCard, HoverCardTrigger, HoverCardContent };
