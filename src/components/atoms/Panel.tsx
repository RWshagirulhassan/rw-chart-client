import * as React from "react";
import { cn } from "@/lib/utils";

export const Panel: React.FC<React.ComponentProps<"div">> = ({
  className,
  ...props
}) => (
  <div
    className={cn("bg-background border rounded-none", className)}
    {...props}
  />
);
