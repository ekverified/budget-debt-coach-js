// src/ErrorBoundary.js
import React from 'react';

/**
 * ErrorBoundary
 * Improvements over original:
 * - Styled error UI matching the app's green/white theme
 * - Retry counter (max 3 auto-retries) prevents infinite reload loops
 * - Collapsible technical details (for debugging without alarming users)
 * - Optional GA4 error reporting (fires if gtag is available)
 * - Error ID shown so users can quote it when reporting issues
 * - componentDidCatch kept for future Sentry/logging integration
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError:    false,
      error:       null,
      errorInfo:   null,
      showDetails: false,
      retryCount:  0,
      errorId:     null,
    };
    this.handleReload  = this.handleReload.bind(this);
    this.handleRetry   = this.handleRetry.bind(this);
    this.toggleDetails = this.toggleDetails.bind(this);
  }

  static getDerivedStateFromError(error) {
    // Generate a short error ID so users can reference it
    const errorId = Math.random().toString(36).slice(2, 8).toUpperCase();
    return { hasError: true, error, errorId };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });

    // Log to console for debugging
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);

    // Report to GA4 if available (non-blocking)
    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'exception', {
          description: `${error?.message || 'Unknown'} | ID: ${this.state.errorId}`,
          fatal: true,
        });
      }
    } catch {
      // GA4 not available — ignore silently
    }

    // Future: send to Sentry
    // Sentry.captureException(error, { contexts: { react: errorInfo } });
  }

  handleRetry() {
    this.setState(prev => ({
      hasError:    false,
      error:       null,
      errorInfo:   null,
      showDetails: false,
      retryCount:  prev.retryCount + 1,
      errorId:     null,
    }));
  }

  handleReload() {
    window.location.reload();
  }

  toggleDetails() {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error, errorInfo, showDetails, retryCount, errorId } = this.state;
    const canRetry = retryCount < 3;

    return (
      <div style={styles.overlay}>
        <div style={styles.card}>
          {/* Icon */}
          <div style={styles.icon} role="img" aria-label="Error">⚠️</div>

          {/* Heading */}
          <h2 style={styles.heading}>Something went wrong</h2>

          {/* Message */}
          <p style={styles.message}>
            {error?.message
              ? `The app ran into an unexpected problem: ${error.message}`
              : 'The app ran into an unexpected problem. Your budget history is safe in your browser.'}
          </p>

          {/* Error ID for support reference */}
          {errorId && (
            <p style={styles.errorId}>
              Error reference: <code style={styles.code}>{errorId}</code>
            </p>
          )}

          {/* Action buttons */}
          <div style={styles.buttonRow}>
            {canRetry && (
              <button style={styles.btnPrimary} onClick={this.handleRetry}>
                Try again
              </button>
            )}
            <button style={styles.btnSecondary} onClick={this.handleReload}>
              Reload app
            </button>
          </div>

          {retryCount >= 3 && (
            <p style={styles.retryWarning}>
              Multiple retries failed. Try clearing your browser cache or{' '}
              <a
                href="https://wa.me/254783621541"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#27ae60' }}
              >
                contact support
              </a>
              .
            </p>
          )}

          {/* Collapsible technical details */}
          <button style={styles.detailsToggle} onClick={this.toggleDetails}>
            {showDetails ? '▲ Hide' : '▼ Show'} technical details
          </button>

          {showDetails && (
            <pre style={styles.details}>
              {error?.toString()}
              {errorInfo?.componentStack
                ? `\n\nComponent stack:${errorInfo.componentStack}`
                : ''}
            </pre>
          )}
        </div>
      </div>
    );
  }
}

/* ── Inline styles ─────────────────────────────────────────────────
   Inline because this component renders when CSS may have failed.   */
const styles = {
  overlay: {
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    minHeight:       '100vh',
    padding:         '24px',
    backgroundColor: '#f1f8e9',
    fontFamily:      '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  card: {
    background:    '#ffffff',
    borderRadius:  '14px',
    padding:       '36px 32px',
    maxWidth:      '480px',
    width:         '100%',
    boxShadow:     '0 8px 32px rgba(0,0,0,0.10)',
    textAlign:     'center',
    border:        '1px solid #A5D6A7',
  },
  icon: {
    fontSize:     '52px',
    marginBottom: '12px',
    lineHeight:    1,
  },
  heading: {
    margin:      '0 0 10px',
    fontSize:    '22px',
    color:       '#2E7D32',
    fontWeight:   700,
  },
  message: {
    margin:    '0 0 16px',
    fontSize:  '15px',
    color:     '#555',
    lineHeight: 1.6,
  },
  errorId: {
    margin:   '0 0 16px',
    fontSize: '13px',
    color:    '#888',
  },
  code: {
    background:   '#f1f8e9',
    padding:      '2px 6px',
    borderRadius: '4px',
    fontFamily:   'monospace',
    fontSize:     '13px',
    color:        '#2E7D32',
  },
  buttonRow: {
    display:        'flex',
    gap:            '10px',
    justifyContent: 'center',
    flexWrap:       'wrap',
    marginBottom:   '16px',
  },
  btnPrimary: {
    padding:         '12px 24px',
    background:      '#4CAF50',
    color:           '#fff',
    border:          'none',
    borderRadius:    '8px',
    fontSize:        '15px',
    fontWeight:       700,
    cursor:          'pointer',
    minWidth:        '130px',
  },
  btnSecondary: {
    padding:         '12px 24px',
    background:      'transparent',
    color:           '#4CAF50',
    border:          '2px solid #4CAF50',
    borderRadius:    '8px',
    fontSize:        '15px',
    fontWeight:       700,
    cursor:          'pointer',
    minWidth:        '130px',
  },
  retryWarning: {
    margin:    '0 0 12px',
    fontSize:  '13px',
    color:     '#e74c3c',
  },
  detailsToggle: {
    background:  'none',
    border:      'none',
    color:       '#888',
    fontSize:    '12px',
    cursor:      'pointer',
    padding:     '4px 0',
    marginTop:   '8px',
    textDecoration: 'underline',
  },
  details: {
    marginTop:    '12px',
    padding:      '12px',
    background:   '#f8f8f8',
    border:       '1px solid #ddd',
    borderRadius: '6px',
    fontSize:     '11px',
    textAlign:    'left',
    overflowX:    'auto',
    color:        '#333',
    lineHeight:    1.5,
    whiteSpace:   'pre-wrap',
    wordBreak:    'break-word',
  },
};

export default ErrorBoundary;
