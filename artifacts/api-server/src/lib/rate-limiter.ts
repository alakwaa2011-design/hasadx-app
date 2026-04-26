import { rateLimit } from "express-rate-limit";

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "محاولات كثيرة جداً. يرجى الانتظار 15 دقيقة قبل المحاولة مرة أخرى." },
  skipSuccessfulRequests: true,
});

export const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "محاولات كثيرة جداً. يرجى الانتظار 15 دقيقة قبل المحاولة مرة أخرى." },
  skipSuccessfulRequests: true,
});

// Throttles unauthenticated/public reads of assignment metadata, class
// rosters, and similar discovery endpoints so a single IP can't enumerate or
// scrape large amounts of data. Caps are sized for school NAT — many students
// share a single public IP and a whole class may load at once, then refresh.
export const publicReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "طلبات كثيرة جداً. يرجى الانتظار قليلاً ثم المحاولة." },
  // Skip for authenticated teachers — they may legitimately fetch many of
  // their own assignments in quick succession (dashboards, exports, etc.).
  skip: (req) => !!req.session?.teacherId,
});

// Image submissions are heavy (multi-megabyte base64 + downstream OCR/AI). Cap
// per-IP requests so an attacker can't drain memory/CPU by spamming uploads.
// Sized for school NAT: a class of ~40 students all submitting paper photos
// from one public IP within a minute should still succeed.
export const imageUploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "تم تجاوز عدد عمليات رفع الصور المسموح بها. حاول بعد دقيقة." },
});

// Generic limiter for sensitive write actions that don't already have a
// dedicated bucket (password change, etc.).
export const sensitiveActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "عدد كبير من المحاولات. يرجى الانتظار قبل إعادة المحاولة." },
});

