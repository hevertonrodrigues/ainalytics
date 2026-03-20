/**
 * Lightweight Sentry error reporting for Deno Edge Functions.
 * Uses the Sentry HTTP Store API — no SDK dependency needed.
 */

interface SentryContext {
  tenantId?: string;
  userId?: string;
  functionName?: string;
}

function getSentryDsn(): { dsn: string; storeUrl: string } | null {
  const dsn = Deno.env.get("SENTRY_DSN");
  if (!dsn) return null;

  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace("/", "");
    const publicKey = url.username;
    const host = url.host;
    const storeUrl = `https://${host}/api/${projectId}/store/?sentry_version=7&sentry_key=${publicKey}`;
    return { dsn, storeUrl };
  } catch {
    return null;
  }
}

export async function reportError(
  error: unknown,
  context?: SentryContext,
): Promise<void> {
  const sentry = getSentryDsn();
  if (!sentry) return;

  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  const event = {
    event_id: crypto.randomUUID().replace(/-/g, ""),
    timestamp: new Date().toISOString(),
    platform: "javascript",
    level: "error",
    logger: "edge-function",
    environment: Deno.env.get("SENTRY_ENVIRONMENT") || "production",
    exception: {
      values: [
        {
          type: error instanceof Error ? error.constructor.name : "Error",
          value: message,
          stacktrace: stack
            ? {
                frames: parseStack(stack),
              }
            : undefined,
        },
      ],
    },
    tags: {
      ...(context?.functionName ? { function: context.functionName } : {}),
      ...(context?.tenantId ? { tenant_id: context.tenantId } : {}),
    },
    user: context?.userId ? { id: context.userId } : undefined,
    extra: {
      ...(context?.tenantId ? { tenant_id: context.tenantId } : {}),
    },
  };

  try {
    await fetch(sentry.storeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
  } catch {
    // Never let Sentry reporting break the function
  }
}

function parseStack(stack: string): Array<{ filename: string; function: string; lineno: number }> {
  return stack
    .split("\n")
    .slice(1)
    .map((line) => {
      const match = line.match(/at (.+?) \((.+?):(\d+):\d+\)/) ||
        line.match(/at (.+?):(\d+):\d+/);
      if (!match) return null;
      return {
        filename: match[2] || match[1] || "unknown",
        function: match[1] || "<anonymous>",
        lineno: parseInt(match[3] || "0", 10),
      };
    })
    .filter(Boolean) as Array<{ filename: string; function: string; lineno: number }>;
}
