import * as React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type PerfRow = {
  metric: string;
  all: { main: string; sub?: string };
  long: { main: string; sub?: string };
  short: { main: string; sub?: string };
  highlight?: boolean;
};

type Props = { rows: PerfRow[]; className?: string };

export const PerformanceTable: React.FC<Props> = ({ rows, className }) => {
  return (
    <ScrollArea className={cn("w-full", className)}>
      <div className="min-w-[900px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[280px]">Metric</TableHead>
              <TableHead>All</TableHead>
              <TableHead>Long</TableHead>
              <TableHead>Short</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i} className={cn(r.highlight && "bg-muted/40")}>
                <TableCell className="font-medium">{r.metric}</TableCell>
                <TableCell>
                  <div>{r.all.main}</div>
                  {r.all.sub && (
                    <div className="text-xs text-muted-foreground">
                      {r.all.sub}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div>{r.long.main}</div>
                  {r.long.sub && (
                    <div className="text-xs text-muted-foreground">
                      {r.long.sub}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div>{r.short.main}</div>
                  {r.short.sub && (
                    <div className="text-xs text-muted-foreground">
                      {r.short.sub}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ScrollArea>
  );
};
