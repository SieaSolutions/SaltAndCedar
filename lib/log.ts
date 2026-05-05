type Level = "info" | "warn" | "error";

export type LogContext = Record<string, unknown> & {
  tick_id?: string;
  run_id?: number;
  city?: string;
  lead_id?: number;
};

function base(level: Level, event: string, ctx: LogContext = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    app: "salt-cedar-leads",
    event,
    ...ctx,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

function serializeErr(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      error_name: err.name,
      error_message: err.message,
      error_stack: err.stack?.slice(0, 2000),
    };
  }
  return { error_message: String(err) };
}

export const log = {
  info(event: string, ctx: LogContext = {}) {
    base("info", event, ctx);
  },
  warn(event: string, ctx: LogContext = {}) {
    base("warn", event, ctx);
  },
  error(event: string, err: unknown, ctx: LogContext = {}) {
    base("error", event, { ...ctx, ...serializeErr(err) });
  },
  timer(event: string, ctx: LogContext = {}) {
    const start = Date.now();
    return () => {
      base("info", event, { ...ctx, elapsed_ms: Date.now() - start });
    };
  },
};
