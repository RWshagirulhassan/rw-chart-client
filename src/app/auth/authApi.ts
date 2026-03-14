import type { AuthSession } from "./authTypes";
import { backendFetch, resolveBackendHref } from "@/lib/runtimeConfig";

function toMessage(status: number, body: unknown): string {
  if (body && typeof body === "object") {
    const maybeError = (body as { error?: unknown }).error;
    if (typeof maybeError === "string" && maybeError.trim()) {
      return maybeError;
    }
    const maybeMessage = (body as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      return maybeMessage;
    }
  }
  return `Auth check failed (${status})`;
}

function parseBody(text: string): unknown {
  if (!text.trim()) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeSession(body: unknown): AuthSession {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid auth session payload");
  }

  const data = body as Record<string, unknown>;
  return {
    linked: data.linked === true,
    expired: data.expired === true,
    userId: typeof data.userId === "string" ? data.userId : null,
    issuedAt: typeof data.issuedAt === "string" ? data.issuedAt : null,
    loginUrl:
      typeof data.loginUrl === "string" && data.loginUrl.trim()
        ? resolveBackendHref(data.loginUrl)
        : null,
  };
}

export async function fetchAuthSession(): Promise<AuthSession> {
  const res = await backendFetch("/api/session", {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  const text = await res.text();
  const body = parseBody(text);

  if (!res.ok) {
    throw new Error(toMessage(res.status, body));
  }

  return normalizeSession(body);
}
