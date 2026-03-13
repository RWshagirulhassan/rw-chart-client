import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const IconButton: React.FC<React.ComponentProps<typeof Button>> = ({ className, variant = "ghost", size = "icon", ...props }) => (
  <Button variant={variant} size={size} className={cn("shrink-0", className)} {...props} />
);
