import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
// Ensure Monaco loads from the local bundle (offline-safe) before any editor mounts.
import "./lib/monacoLoader";

// Register service worker for offline caching
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(<App />);
