import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './ErrorBoundary'; // NEW: For graceful error handling
import reportWebVitals from './reportWebVitals'; // NEW: For performance monitoring

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// NEW: Optional: Log performance metrics to console (remove in full production if not needed)
reportWebVitals(console.log);

export default root; // NEW: Export for potential SSR/testing
