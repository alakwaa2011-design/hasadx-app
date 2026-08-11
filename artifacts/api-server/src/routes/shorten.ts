import { Router, type IRouter, type Request, type Response } from "express";
import { getGame } from "../game/manager";

const router: IRouter = Router();

// Simple in-memory cache: full URL → short URL
const shortenCache = new Map<string, string>();

router.get("/shorten", async (req: Request, res: Response) => {
  const url = req.query.url as string | undefined;
  if (!url || !url.startsWith("http")) {
    return res.status(400).json({ error: "Invalid url" });
  }

  if (shortenCache.has(url)) {
    return res.json({ short: shortenCache.get(url) });
  }

  try {
    const apiUrl = `https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`;
    const response = await fetch(apiUrl, {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "Hasad-App/1.0" },
    });
    if (!response.ok) throw new Error(`is.gd ${response.status}`);
    const short = (await response.text()).trim();
    if (!short.startsWith("http")) throw new Error("bad response");
    shortenCache.set(url, short);
    return res.json({ short });
  } catch {
    return res.json({ short: url, fallback: true });
  }
});

/**
 * GET /api/g/:pin
 * Serves an HTML page with Open Graph meta tags for the game (so WhatsApp /
 * Telegram previews show the lesson title and Hasad branding), then
 * immediately redirects the browser to the actual join page.
 */
router.get("/g/:pin", (req: Request, res: Response) => {
  const pin = String(req.params.pin);
  const game = getGame(pin);

  const siteName = "منصة حصاد";
  const title = game?.assignmentTitle
    ? `${game.assignmentTitle} — انضم إلى اللعبة`
    : "انضم إلى لعبة حصاد";
  const description = `رمز الانضمام: ${pin} | ادخل هذا الرمز على منصة حصاد للانضمام إلى اللعبة.`;
  const ogImage = "https://hasadx.com/opengraph.jpg";
  // Redirect target is the SPA join page (same domain, absolute path)
  const joinPath = `/game/join/${pin}`;

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(title)}</title>

<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:locale" content="ar_AR">
<meta property="og:site_name" content="${escHtml(siteName)}">
<meta property="og:title" content="${escHtml(title)}">
<meta property="og:description" content="${escHtml(description)}">
<meta property="og:image" content="${ogImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escHtml(title)}">
<meta name="twitter:description" content="${escHtml(description)}">
<meta name="twitter:image" content="${ogImage}">

<meta http-equiv="refresh" content="0;url=${joinPath}">
</head>
<body>
<script>window.location.replace(${JSON.stringify(joinPath)});</script>
<p>جارٍ التحويل… <a href="${joinPath}">انقر هنا إذا لم يتم التحويل تلقائياً</a></p>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // Cache 10 min so crawlers don't hammer us, but short enough that
  // a new game on the same PIN gets fresh OG tags quickly.
  res.setHeader("Cache-Control", "public, max-age=600");
  res.send(html);
});

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default router;
