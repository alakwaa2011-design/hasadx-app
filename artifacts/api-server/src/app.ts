import express, { type Express } from "express";
import * as Sentry from "@sentry/node";
import compression from "compression";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";
import { localizeApiMessages } from "./lib/request-locale";
import { unauthorizedAccessActivityLogger } from "./lib/unauthorized-access-logger";

export async function ensureSessionTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "session" (
      "sid" varchar NOT NULL COLLATE "default",
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL,
      CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
    );
    CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
  `);
}

const SESSION_SECRET = process.env.SESSION_SECRET;
const DEFAULT_SECRET = "homework-app-secret-key";
const isProduction = process.env.NODE_ENV === "production";

if (!SESSION_SECRET || SESSION_SECRET === DEFAULT_SECRET) {
  throw new Error(
    "SESSION_SECRET environment variable must be set to a strong random value. " +
    "Generate one with: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"",
  );
}

const PgSession = connectPgSimple(session);

const app: Express = express();

app.set("trust proxy", 1);
app.set("etag", false);

// تحويل 301 دائم من النطاق القديم hasadx.com (وwww) إلى النطاق الرسمي hasaadx.com
// مع الحفاظ الكامل على المسار وquery string. طلبات hasaadx.com لا تُمس — لا loop.
const LEGACY_HOSTS = new Set(["hasadx.com", "www.hasadx.com"]);
app.use((req, res, next) => {
  const host = (req.hostname || "").toLowerCase();
  if (LEGACY_HOSTS.has(host)) {
    res.redirect(301, "https://hasaadx.com" + req.originalUrl);
    return;
  }
  next();
});

app.use(compression());
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        scriptSrc: ["'none'"],
        styleSrc: ["'none'"],
        imgSrc: ["'none'"],
        connectSrc: ["'self'"],
        fontSrc: ["'none'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'none'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

const rawAllowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : null;

if (rawAllowedOrigins !== null) {
  if (rawAllowedOrigins.length === 0) {
    throw new Error("ALLOWED_ORIGINS is set but contains no valid entries.");
  }
  for (const entry of rawAllowedOrigins) {
    let parsedOrigin: string;
    try {
      parsedOrigin = new URL(entry).origin;
    } catch {
      throw new Error(`ALLOWED_ORIGINS contains an invalid URL: "${entry}". Expected format: https://example.com`);
    }
    if (parsedOrigin !== entry) {
      throw new Error(
        `ALLOWED_ORIGINS entry "${entry}" must be an origin only (no path, no trailing slash). ` +
        `Expected: "${parsedOrigin}"`,
      );
    }
  }
}

const allowedOrigins = rawAllowedOrigins;

if (isProduction && !allowedOrigins) {
  logger.warn(
    "ALLOWED_ORIGINS is not set — cross-origin requests from other domains will be blocked. " +
    "Set ALLOWED_ORIGINS to your deployment URL (e.g. https://hasadx.replit.app) if needed.",
  );
}

export function corsOriginFn(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
): void {
  if (!origin) {
    return callback(null, true);
  }
  if (!allowedOrigins) {
    if (isProduction) {
      return callback(new Error("Not allowed by CORS"), false);
    }
    return callback(null, true);
  }
  if (allowedOrigins.includes(origin)) {
    return callback(null, true);
  }
  return callback(new Error("Not allowed by CORS"), false);
}

app.use(
  cors({
    origin: corsOriginFn,
    credentials: true,
  }),
);

// Keep UI feedback localized for every API router. This sits at the API
// registration boundary rather than on individual routers so newly mounted
// routes cannot silently miss localization. It only replaces top-level
// `message`/`error` strings and leaves response data intact.
app.use("/api", localizeApiMessages);

const IMAGE_UPLOAD_PATHS = new Set(["/api/ai/extract-questions-from-image"]);
// Routes that may carry image data (paper-submission photo, whiteboard PNG
// dataURLs, etc.) get the larger 8mb cap.
const IMAGE_UPLOAD_PATTERN = /^\/api\/assignments\/\d+\/(submit|submit-image)$/;
// Assignment create/update payloads may embed manually-added question images
// as base64 dataURLs (several MB each), so they get a larger cap too.
const ASSIGNMENT_BODY_PATTERN = /^\/api\/assignments(\/\d+)?$/;

// Image-bearing endpoints get a higher cap (camera photos can run a few MB)
// but we cap at 8mb to make memory exhaustion attacks much harder. Other
// endpoints stay at a tight 2mb — most JSON payloads are well under 100KB.
app.use((req, res, next) => {
  // Lemon Squeezy webhook: keep the RAW body — HMAC signature verification
  // must run against the exact bytes received, before any JSON parsing.
  if (req.path === "/api/webhooks/lemonsqueezy" || req.path === "/api/webhooks/whatsapp") {
    express.raw({ type: "*/*", limit: "2mb" })(req, res, next);
    return;
  }
  const isImageUpload =
    IMAGE_UPLOAD_PATHS.has(req.path) ||
    IMAGE_UPLOAD_PATTERN.test(req.path) ||
    (STATE_MUTATING_METHODS.has(req.method) && ASSIGNMENT_BODY_PATTERN.test(req.path));
  express.json({ limit: isImageUpload ? "25mb" : "2mb" })(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

const STATE_MUTATING_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);
app.use((req, res, next) => {
  if (!STATE_MUTATING_METHODS.has(req.method)) return next();
  // Lemon Squeezy webhooks carry no Origin/Referer — they are authenticated
  // by HMAC signature (X-Signature) inside the route itself, not by CSRF origin.
  if (req.path === "/api/webhooks/lemonsqueezy" || req.path === "/api/webhooks/whatsapp") return next();
  if (!isProduction || !allowedOrigins) return next();

  const rawOrigin = req.headers.origin ?? req.headers.referer;
  if (!rawOrigin) {
    res.status(403).json({ message: "طلب غير مصرح" });
    return;
  }

  let requestOrigin: string;
  try {
    requestOrigin = new URL(rawOrigin).origin;
  } catch {
    res.status(403).json({ message: "طلب غير مصرح" });
    return;
  }

  if (!allowedOrigins.includes(requestOrigin)) {
    res.status(403).json({ message: "طلب غير مصرح" });
    return;
  }

  next();
});

export const sessionMiddleware = session({
  store: new PgSession({
    pool,
    tableName: "session",
  }),
  secret: SESSION_SECRET as string,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction,
    httpOnly: true,
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000,
  },
});

app.use(sessionMiddleware);

const TEACHER_SESSION_TOUCH_MS = 5 * 60 * 1000;
app.use((req, _res, next) => {
  const sess: any = req.session;
  if (sess?.teacherId) {
    const last = sess.lastSeenAt ? Date.parse(sess.lastSeenAt) : 0;
    if (!last || Date.now() - last > TEACHER_SESSION_TOUCH_MS) {
      sess.lastSeenAt = new Date().toISOString();
      const ua = req.headers["user-agent"];
      if (typeof ua === "string" && ua.length > 0 && !sess.userAgent) {
        sess.userAgent = ua.slice(0, 500);
      }
      if (!sess.ip) sess.ip = req.ip ?? null;
      if (!sess.createdAt) sess.createdAt = new Date().toISOString();
    }
  }
  next();
});

// Auto-log unauthorized access attempts (401/403) on /api/* routes, excluding
// sensitive verification endpoints whose query strings can contain secrets.
app.use(unauthorizedAccessActivityLogger());

app.use("/api", router);

Sentry.setupExpressErrorHandler(app);

export default app;
