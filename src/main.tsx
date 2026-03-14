import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import TradingPage from "./app/pages/TradingPage";
import EmbedChartPage from "./app/pages/EmbedChartPage";
import { TooltipProvider } from "./components/ui/tooltip";
import { AuthProvider } from "./app/auth/AuthContext";
import { AuthGate } from "./app/auth/AuthGate";
import {
  getRuntimeConfigPath,
  loadRuntimeConfig,
} from "./lib/runtimeConfig";

document.documentElement.classList.remove("dark");
document.documentElement.style.colorScheme = "light";

function isEmbedRoute(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.location.pathname.startsWith("/embed/chart");
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error('Client root element "#root" was not found.');
}

const root = ReactDOM.createRoot(rootElement);

function App() {
  return (
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
  );
}

function renderStartupError(message: string) {
  root.render(
    <div className="h-screen w-full bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-lg border bg-card text-card-foreground p-6 space-y-4">
        <div className="text-lg font-semibold">Startup configuration failed</div>
        <p className="text-sm text-muted-foreground">
          The app could not load its backend runtime config from{" "}
          <code>{getRuntimeConfigPath()}</code>.
        </p>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>,
  );
}

async function bootstrap() {
  try {
    await loadRuntimeConfig();
    root.render(<App />);
  } catch (error: unknown) {
    renderStartupError(
      error instanceof Error ? error.message : "Failed to load runtime config.",
    );
  }
}

void bootstrap();
