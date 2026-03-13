"use client";

import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type SelectContextValue = {
  value?: string;
  onValueChange?: (value: string) => void;
};

const SelectContext = React.createContext<SelectContextValue>({});

const Select = ({
  value,
  onValueChange,
  children,
}: {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}) => (
  <SelectContext.Provider value={{ value, onValueChange }}>
    <DropdownMenu>{children}</DropdownMenu>
  </SelectContext.Provider>
);

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuTrigger>
>(({ className, ...props }, ref) => (
  <DropdownMenuTrigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm hover:bg-accent hover:text-accent-foreground",
      className
    )}
    {...props}
  />
));
SelectTrigger.displayName = "SelectTrigger";

const SelectContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuContent
    ref={ref}
    className={cn("min-w-[8rem]", className)}
    {...props}
  />
));
SelectContent.displayName = "SelectContent";

const SelectItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuItem> & { value: string }
>(({ className, value, onSelect, ...props }, ref) => {
  const { onValueChange } = React.useContext(SelectContext);
  return (
    <DropdownMenuItem
      ref={ref}
      className={cn("gap-2", className)}
      onSelect={(event) => {
        onSelect?.(event);
        onValueChange?.(value);
      }}
      {...props}
    />
  );
});
SelectItem.displayName = "SelectItem";

export { Select, SelectTrigger, SelectContent, SelectItem };
