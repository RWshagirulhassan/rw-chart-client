import * as React from "react";
import {
  PerformanceTable,
  PerfRow,
} from "@/components/molecules/PerformanceTable";

export const PerformanceSection: React.FC<{ rows: PerfRow[] }> = ({ rows }) => {
  return <PerformanceTable rows={rows} />;
};
