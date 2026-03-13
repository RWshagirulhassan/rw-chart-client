import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import TradingPage from "./app/pages/TradingPage";
import EmbedChartPage from "./app/pages/EmbedChartPage";
import { TooltipProvider } from "./components/ui/tooltip";
import { AuthProvider } from "./app/auth/AuthContext";
import { AuthGate } from "./app/auth/AuthGate";

document.documentElement.classList.remove("dark");
document.documentElement.style.colorScheme = "light";

function isEmbedRoute(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.location.pathname.startsWith("/embed/chart");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  // <React.StrictMode>
  <TooltipProvider delayDuration={200}>
    {isEmbedRoute() ? (
      <EmbedChartPage />
    ) : (
      <AuthProvider>
        <AuthGate>
          <TradingPage />
        </AuthGate>
      </AuthProvider>
    )}
  </TooltipProvider>
  // </React.StrictMode>
);
