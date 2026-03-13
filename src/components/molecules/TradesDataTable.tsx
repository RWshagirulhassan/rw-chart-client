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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type TradeLeg = "Entry" | "Exit";
export type TradeSide = "Long" | "Short";

export type TradeRow = {
  tradeNo: number; // grouped number (repeats for entry/exit)
  leg: TradeLeg; // Entry | Exit
  side: TradeSide; // Long | Short
  date: string; // "Oct 15, 2025"
  signal: string; // "Short Exit"
  price: string; // "188.56 INR"
  position: string; // "1.09K"
  netPnL: string; // "+2,433.434 INR"
  runUp: string; // "2,747.281 INR"
  drawdown: string; // "-662.759 INR"
  cumulative: string; // "108,315.48 INR"
};

type Props = {
  rows: TradeRow[];
  className?: string;
};

const SideBadge = ({ side }: { side: TradeSide }) => (
  <Badge
    variant="secondary"
    className={cn(
      "rounded-full",
      side === "Long" ? "text-emerald-400" : "text-rose-400"
    )}
  >
    {side}
  </Badge>
);

export const TradesDataTable: React.FC<Props> = ({ rows, className }) => {
  return (
    <ScrollArea className={cn("w-full h-[520px]", className)}>
      <div className="min-w-[1100px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[90px]">Trade #</TableHead>
              <TableHead className="w-[90px]">Type</TableHead>
              <TableHead className="w-[160px]">Date/Time</TableHead>
              <TableHead className="w-[160px]">Signal</TableHead>
              <TableHead className="w-[120px]">Price</TableHead>
              <TableHead className="w-[120px]">Position size</TableHead>
              <TableHead className="w-[140px]">Net P&amp;L</TableHead>
              <TableHead className="w-[120px]">Run-up</TableHead>
              <TableHead className="w-[140px]">Drawdown</TableHead>
              <TableHead className="w-[160px]">Cumulative P&amp;L</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => {
              const shaded = r.leg === "Entry"; // shade entry row to group pairs
              return (
                <TableRow key={i} className={cn(shaded && "bg-muted/40")}>
                  <TableCell className="font-medium">{r.tradeNo}</TableCell>
                  <TableCell className="flex items-center gap-2">
                    <span className="text-muted-foreground">{r.leg}</span>
                    <SideBadge side={r.side} />
                  </TableCell>
                  <TableCell>{r.date}</TableCell>
                  <TableCell>{r.signal}</TableCell>
                  <TableCell>{r.price}</TableCell>
                  <TableCell>{r.position}</TableCell>
                  <TableCell
                    className={cn(
                      r.netPnL.startsWith("-")
                        ? "text-rose-500"
                        : "text-emerald-500"
                    )}
                  >
                    {r.netPnL}
                  </TableCell>
                  <TableCell>{r.runUp}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.drawdown}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.cumulative}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </ScrollArea>
  );
};
