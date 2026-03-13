import * as React from "react";
import { KpiStat } from "@/components/atoms/KpiStat";
import { EquityCurveMock } from "@/components/molecules/EquityCurveMock";
import { Separator } from "@/components/ui/separator";

export type OverviewProps = {
  kpis: Array<{ label: string; value: string; sub?: string; tooltip?: string }>;
};

export const OverviewSection: React.FC<OverviewProps> = ({ kpis }) => {
  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-8 px-1">
        {kpis.map((k) => (
          <KpiStat key={k.label} {...k} />
        ))}
      </div>
      <Separator />
      {/* Equity curve mock */}
      <EquityCurveMock />
    </div>
  );
};
