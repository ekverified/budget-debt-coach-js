// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './ErrorBoundary';

// ─── Service Worker registration ───────────────────────────────────
// All SW logic lives here; App.js only sends messages — it does NOT
// call navigator.serviceWorker.register() again (that caused double
// registration in the original codebase).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Bump CACHE_BUST on every deploy to force the browser to
    // re-download the service worker file (bypasses 24-hr SW cache).
    const CACHE_BUST = '1.2';
    const swUrl = `/service-worker.js?v=${CACHE_BUST}`;

    navigator.serviceWorker
      .register(swUrl)
      .then((registration) => {
        // Listen for an update being found (new SW downloading)
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // Tell the new SW to activate immediately.
              // App.js shows the "Update available" banner; user
              // taps "Update now" which sends SKIP_WAITING.
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch((error) => {
        // Non-fatal — app still works without SW
        console.warn('[index] SW registration failed:', error);
      });

    // Reload the page when a new SW takes control, so the user
    // always runs the latest version of the app shell.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  });

  // Re-check for SW updates every time the tab regains focus.
  // Useful for users who keep the app open for days on mobile.
  window.addEventListener('focus', () => {
    navigator.serviceWorker.ready.then((registration) => {
      registration.update().catch(() => {
        // Silently ignore — network may be offline
      });
    });
  });
}

// ─── React root ────────────────────────────────────────────────────
const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
