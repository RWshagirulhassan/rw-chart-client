import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { OverviewSection } from "./OverviewSection";
import { PerformanceSection } from "./PerformanceSection";
import { TradesSection } from "./TradesSection";
import type { PerfRow } from "@/components/molecules/PerformanceTable";
import type { TradeRow } from "@/components/molecules/TradesDataTable";

// If you already added ReportSectionSelector from the previous step, import it:
import {
  ReportSectionSelector,
  ReportSection,
} from "@/components/organisms/ReportSectionSelector";

// If you DON'T have it, you can temporarily replace the selector
// with shadcn Tabs in this file—keeping the rest identical.

type Props = {
  kpis: Array<{ label: string; value: string; sub?: string; tooltip?: string }>;
  performance: PerfRow[];
  trades: TradeRow[];
  className?: string;
};

export const StrategyTesterPanel: React.FC<Props> = ({
  kpis,
  performance,
  trades,
  className,
}) => {
  const [section, setSection] = React.useState<ReportSection>("overview");

  return (
    <Card className={className}>
      <CardContent className="pt-4 space-y-4">
        {/* Selector */}
        <ReportSectionSelector value={section} onChange={setSection} />

        {/* Body */}
        <div className="space-y-4">
          {section === "overview" && <OverviewSection kpis={kpis} />}
          {section === "performance" && (
            <PerformanceSection rows={performance} />
          )}
          {section === "trades" && <TradesSection rows={trades} />}
          {section === "risk" && (
            <div className="text-sm text-muted-foreground">
              Risk/performance ratios (placeholder) – add another table using
              the PerformanceTable molecule.
            </div>
          )}
          {section === "list" && <TradesSection rows={trades} />}
        </div>

        <Separator className="opacity-0" />
      </CardContent>
    </Card>
  );
};
