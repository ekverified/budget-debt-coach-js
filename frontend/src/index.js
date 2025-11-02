import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './ErrorBoundary';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Cache-bust SW for reliable updates (increment VERSION on deploys)
    const VERSION = '1.1'; // Bump this on changes
    const swUrl = `/service-worker.js?v=${VERSION}`;
    
    navigator.serviceWorker.register(swUrl)
      .then((registration) => {
        console.log('SW registered: ', registration);
        
        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // Broadcast update to app
                navigator.serviceWorker.controller.postMessage({ type: 'UPDATE_AVAILABLE' });
                // Auto-skip waiting for immediate activation on next load
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            }
          });
        });
      })
      .catch((error) => {
        console.log('SW registration failed: ', error);
      });
  });

  // Auto-reload on controller change (new SW active)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });

  // Request SW update on focus (for when app re-opens)
  window.addEventListener('focus', () => {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'UPDATE_CHECK' });
    }
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

export default root; // Keep for testing
