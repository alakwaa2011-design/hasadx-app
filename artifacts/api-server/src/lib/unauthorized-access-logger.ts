import type { RequestHandler } from "express";
import { logActivity, type LogActivityInput } from "./activity-logger";

type ActivityRecorder = (input: LogActivityInput) => void;

const SENSITIVE_WEBHOOK_PATHS = new Set([
  "/api/webhooks/whatsapp",
]);

/**
 * Records denied API access without observing sensitive verification URLs.
 * Webhook verification tokens are query parameters, so these routes must be
 * excluded before a response listener is attached.
 */
export function unauthorizedAccessActivityLogger(
  recordActivity: ActivityRecorder = logActivity,
): RequestHandler {
  return (req, res, next) => {
    if (!req.path.startsWith("/api/")) return next();
    if (
      req.path === "/api/activity/page-view" ||
      req.path.startsWith("/api/health") ||
      SENSITIVE_WEBHOOK_PATHS.has(req.path)
    ) {
      return next();
    }

    res.on("finish", () => {
      try {
        if (res.statusCode !== 401 && res.statusCode !== 403) return;

        const sess: any = (req as any).session;
        const userId = sess?.teacherId ?? sess?.studentAccountId ?? null;
        const userRole: "teacher" | "student" | "visitor" = sess?.teacherId
          ? "teacher"
          : (sess?.studentAccountId ? "student" : "visitor");
        recordActivity({
          req,
          userId,
          userRole,
          action: "unauthorized_access",
          details: { method: req.method, path: req.path, status: res.statusCode },
          pageUrl: req.originalUrl,
        });
      } catch {
        // Never let activity logging affect the response path.
      }
    });
    next();
  };
}