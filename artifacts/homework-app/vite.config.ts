import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { readFile } from "node:fs/promises";

const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : 3000;

const basePath = process.env.BASE_PATH || "/";
const includeRuntimeErrorOverlay = process.env.E2E_TEST !== "1";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "quran-install-manifest",
      configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
          const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
          if (request.method !== "GET" || !/^\/quran(?:\/\d{1,3})?\/?$/.test(pathname)) return next();
          try {
            const source = await readFile(path.resolve(import.meta.dirname, "index.html"), "utf8");
            const html = await server.transformIndexHtml(pathname, source);
            response.setHeader("Content-Type", "text/html; charset=utf-8");
            response.end(html);
          } catch (error) {
            next(error);
          }
        });
      },
      transformIndexHtml(html, context) {
        if (!/^\/quran(?:\/|$)/.test(context.path)) return html;
        return html
          .replace("<title>منصة حصاد | أنشئ وشارك وتفاعل في تجربة تعليمية متكاملة</title>", "<title>مصحف حصاد | قراءة واستماع وحفظ</title>")
          .replace('href="/manifest.json"', 'href="/quran-manifest.json"')
          .replace('sizes="32x32" href="/icons/icon-192.png"', 'sizes="1254x1254" href="/icons/quran-hasaad.png"')
          .replace('href="/icons/apple-touch-icon.png"', 'href="/icons/quran-hasaad.png"')
          .replace('name="apple-mobile-web-app-title" content="حصاد"', 'name="apple-mobile-web-app-title" content="مصحف حصاد"')
          .replace('property="og:site_name" content="منصة حصاد"', 'property="og:site_name" content="مصحف حصاد"')
          .replace('property="og:title" content="منصة حصاد | أنشئ وشارك وتفاعل في تجربة تعليمية متكاملة"', 'property="og:title" content="مصحف حصاد"')
          .replace('property="og:url" content="https://hasaadx.com/"', 'property="og:url" content="https://hasaadx.com/quran"')
          .replace('name="twitter:title" content="منصة حصاد | أنشئ وشارك وتفاعل في تجربة تعليمية متكاملة"', 'name="twitter:title" content="مصحف حصاد"')
          .replaceAll('https://hasaadx.com/opengraph.jpg', 'https://hasaadx.com/icons/quran-hasaad.png')
          .replace('property="og:image:width" content="1200"', 'property="og:image:width" content="1254"')
          .replace('property="og:image:height" content="630"', 'property="og:image:height" content="1254"')
          .replace('property="og:image:alt" content="منصة حصاد التعليمية — HasadX"', 'property="og:image:alt" content="أيقونة مصحف حصاد"');
      },
    },
    ...(includeRuntimeErrorOverlay ? [runtimeErrorOverlay()] : []),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // NOTE: no manualChunks — hand-splitting react/react-dom away from other
    // vendor code caused a circular chunk-init order bug in production
    // ("Cannot set properties of undefined (setting 'Children')") that left
    // the site permanently blank. Let Rollup decide chunking.
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    proxy: process.env.API_PROXY_TARGET
      ? {
          "/api": {
            target: process.env.API_PROXY_TARGET,
            changeOrigin: true,
            ws: true,
          },
        }
      : undefined,
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
