import * as React from "react";
import {
  TradesDataTable,
  TradeRow,
} from "@/components/molecules/TradesDataTable";

export const TradesSection: React.FC<{ rows: TradeRow[] }> = ({ rows }) => {
  return <TradesDataTable rows={rows} />;
};
