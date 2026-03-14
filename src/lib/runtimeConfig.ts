export type RuntimeConfig = {
  apiBaseUrl: string;
  wsBaseUrl?: string;
};

type ResolvedRuntimeConfig = {
  apiBaseUrl: string;
  wsBaseUrl: string;
};

const RUNTIME_CONFIG_PATH = "/runtime-config.json";

let runtimeConfig: ResolvedRuntimeConfig | null = null;
let runtimeConfigPromise: Promise<ResolvedRuntimeConfig> | null = null;

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizeBaseUrl(
  value: unknown,
  fieldName: string,
  allowedProtocols: string[],
): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Runtime config "${fieldName}" must be a non-empty URL.`);
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Runtime config "${fieldName}" is not a valid URL.`);
  }

  if (!allowedProtocols.includes(url.protocol)) {
    throw new Error(
      `Runtime config "${fieldName}" must use one of: ${allowedProtocols.join(", ")}.`,
    );
  }

  url.hash = "";
  return trimTrailingSlash(url.toString());
}

function deriveWsBaseUrl(apiBaseUrl: string): string {
  const url = new URL(apiBaseUrl);
  if (url.protocol === "http:") {
    url.protocol = "ws:";
  } else if (url.protocol === "https:") {
    url.protocol = "wss:";
  } else {
    throw new Error('Runtime config "apiBaseUrl" must use http: or https:.');
  }
  return trimTrailingSlash(url.toString());
}

function ensureRuntimeConfig(): ResolvedRuntimeConfig {
  if (!runtimeConfig) {
    throw new Error(
      `Runtime config has not been loaded yet. Expected ${RUNTIME_CONFIG_PATH} to be loaded before app startup.`,
    );
  }
  return runtimeConfig;
}

function joinBaseUrl(baseUrl: string, path: string): string {
  const normalizedPath = path.trim().replace(/^\/+/, "");
  return new URL(normalizedPath, `${trimTrailingSlash(baseUrl)}/`).toString();
}

export async function loadRuntimeConfig(): Promise<ResolvedRuntimeConfig> {
  if (runtimeConfig) {
    return runtimeConfig;
  }

  if (!runtimeConfigPromise) {
    runtimeConfigPromise = (async () => {
      const response = await fetch(RUNTIME_CONFIG_PATH, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error(
          `Failed to load ${RUNTIME_CONFIG_PATH} (${response.status}).`,
        );
      }

      const payload = (await response.json()) as RuntimeConfig;
      const apiBaseUrl = normalizeBaseUrl(
        payload.apiBaseUrl,
        "apiBaseUrl",
        ["http:", "https:"],
      );
      const wsBaseUrl =
        payload.wsBaseUrl == null
          ? deriveWsBaseUrl(apiBaseUrl)
          : normalizeBaseUrl(payload.wsBaseUrl, "wsBaseUrl", ["ws:", "wss:"]);

      runtimeConfig = { apiBaseUrl, wsBaseUrl };
      return runtimeConfig;
    })().catch((error: unknown) => {
      runtimeConfigPromise = null;
      throw error instanceof Error
        ? error
        : new Error("Failed to load runtime config.");
    });
  }

  return runtimeConfigPromise;
}

export function apiUrl(path: string): string {
  return joinBaseUrl(ensureRuntimeConfig().apiBaseUrl, path);
}

export function wsUrl(path: string): string {
  return joinBaseUrl(ensureRuntimeConfig().wsBaseUrl, path);
}

export function resolveBackendHref(value: string): string {
  try {
    return new URL(value).toString();
  } catch {
    return apiUrl(value);
  }
}

export function backendFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(apiUrl(path), {
    credentials: init?.credentials ?? "include",
    ...init,
  });
}

export function getRuntimeConfigPath(): string {
  return RUNTIME_CONFIG_PATH;
}
