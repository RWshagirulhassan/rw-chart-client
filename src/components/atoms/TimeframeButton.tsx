import * as React from "react";
import { Button } from "@/components/ui/button";

export const TimeframeButton: React.FC<{
  label: string;
  active?: boolean;
  onClick?: () => void;
}> = ({ label, active, onClick }) => (
  <Button
    variant={active ? "secondary" : "ghost"}
    size="sm"
    className="h-8 px-2"
    onClick={onClick}
  >
    {label}
  </Button>
);
