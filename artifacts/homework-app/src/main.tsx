import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initGA } from "./lib/gtag";
import { initMetaPixel } from "./lib/meta-pixel";
import { ErrorBoundary } from "./components/error-boundary";
import { I18nProvider } from "./lib/i18n";

initGA();
initMetaPixel();

createRoot(document.getElementById("root")!).render(
  <I18nProvider>
    <ErrorBoundary label="HasadX">
      <App />
    </ErrorBoundary>
  </I18nProvider>,
);

// إخفاء شاشة التحميل بعد أن يحمّل React
const splash = document.getElementById("hasad-splash");
if (splash) {
  splash.style.transition = "opacity 0.35s ease";
  splash.style.opacity = "0";
  setTimeout(() => splash.remove(), 380);
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        registration.update().catch(() => {});
        setInterval(() => { registration.update().catch(() => {}); }, 60 * 60 * 1000);
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
        let refreshing = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });
      })
      .catch(() => {});
  });
}
