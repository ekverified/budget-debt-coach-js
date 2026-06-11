// src/components/Auth.js
import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Auth
 * Improvements over original:
 * - Cloudflare Turnstile wired correctly: rendered via useEffect + ref,
 *   not via a <script> tag inside JSX (which React ignores / is invalid)
 * - Turnstile script loaded once via useEffect, not re-injected on render
 * - Loading state on all async actions (prevents double-submit)
 * - Error message cleared when user starts typing (better UX)
 * - isSignup mode resets error and form on toggle
 * - Accessible form: labels, aria-describedby for errors, autocomplete hints
 * - No direct alert() — error displayed inline
 * - Social buttons disabled while loading
 * - Password reset confirmation shown inline (not alert)
 * - firebase imports left as-is (your firebase.js config drives this)
 */

import {
  auth,
  googleProvider,
  facebookProvider,
  twitterProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from '../firebase';

const Auth = ({ onAuthChange }) => {
  const [email,          setEmail]          = useState('');
  const [password,       setPassword]       = useState('');
  const [isSignup,       setIsSignup]       = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [error,          setError]          = useState('');
  const [resetSent,      setResetSent]      = useState(false);
  const [loading,        setLoading]        = useState(false);

  const turnstileRef      = useRef(null);  // DOM node for Turnstile widget
  const turnstileWidgetId = useRef(null);  // Turnstile widget ID for reset
  const errorId           = 'auth-error';

  /* ── Load Turnstile script once ── */
  useEffect(() => {
    if (document.getElementById('turnstile-script')) return;

    const script = document.createElement('script');
    script.id    = 'turnstile-script';
    script.src   = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      // Do NOT remove script on unmount — it's global and needed for the widget
    };
  }, []);

  /* ── Render Turnstile widget when signup mode is active ── */
  useEffect(() => {
    if (!isSignup || !turnstileRef.current) return;

    // Wait for the Turnstile script to be ready
    const renderWidget = () => {
      if (!window.turnstile) return;

      // Clean up any existing widget first
      if (turnstileWidgetId.current !== null) {
        window.turnstile.remove(turnstileWidgetId.current);
        turnstileWidgetId.current = null;
      }

      turnstileWidgetId.current = window.turnstile.render(turnstileRef.current, {
        sitekey:  process.env.REACT_APP_TURNSTILE_SITE_KEY || 'your-turnstile-sitekey',
        callback: (token) => {
          setTurnstileToken(token);
          setError('');
        },
        'expired-callback': () => {
          setTurnstileToken('');
        },
        'error-callback': () => {
          setTurnstileToken('');
          setError('Human verification failed. Please refresh and try again.');
        },
      });
    };

    // If script already loaded, render now; otherwise poll until ready
    if (window.turnstile) {
      renderWidget();
    } else {
      const interval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(interval);
          renderWidget();
        }
      }, 200);
      return () => clearInterval(interval);
    }

    return () => {
      // Cleanup widget on unmount or mode switch
      if (turnstileWidgetId.current !== null && window.turnstile) {
        window.turnstile.remove(turnstileWidgetId.current);
        turnstileWidgetId.current = null;
      }
    };
  }, [isSignup]);

  /* ── Social login ── */
  const handleSocialLogin = useCallback(async (provider) => {
    setError('');
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, provider);
      onAuthChange(result.user);
    } catch (err) {
      setError(friendlyError(err.code) || err.message);
    } finally {
      setLoading(false);
    }
  }, [onAuthChange]);

  /* ── Email auth ── */
  const handleEmailAuth = useCallback(async (e) => {
    e.preventDefault();
    if (isSignup && !turnstileToken) {
      setError('Please complete the human verification to sign up.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      if (isSignup) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onAuthChange({ email });
    } catch (err) {
      setError(friendlyError(err.code) || err.message);
      // Reset Turnstile on failed signup so user can try again
      if (isSignup && turnstileWidgetId.current !== null && window.turnstile) {
        window.turnstile.reset(turnstileWidgetId.current);
        setTurnstileToken('');
      }
    } finally {
      setLoading(false);
    }
  }, [isSignup, turnstileToken, email, password, onAuthChange]);

  /* ── Password reset ── */
  const handleResetPassword = useCallback(async () => {
    if (!email) { setError('Enter your email address above first.'); return; }
    setError('');
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err) {
      setError(friendlyError(err.code) || err.message);
    } finally {
      setLoading(false);
    }
  }, [email]);

  /* ── Toggle signup / login ── */
  const toggleMode = useCallback(() => {
    setIsSignup(v => !v);
    setError('');
    setResetSent(false);
    setTurnstileToken('');
  }, []);

  /* ── Clear error on typing ── */
  const handleEmailChange = (e) => { setEmail(e.target.value); setError(''); setResetSent(false); };
  const handlePassChange  = (e) => { setPassword(e.target.value); setError(''); };

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>{isSignup ? 'Create account' : 'Welcome back'}</h2>
      <p style={styles.sub}>{isSignup ? 'Start your free budget plan.' : 'Sign in to access your budget.'}</p>

      {/* Social login */}
      <div style={styles.socialRow}>
        {[
          { label: 'Google',   provider: googleProvider,   emoji: '🇬' },
          { label: 'Facebook', provider: facebookProvider, emoji: '🇫' },
          { label: 'X',        provider: twitterProvider,  emoji: '𝕏' },
        ].map(({ label, provider, emoji }) => (
          <button
            key={label}
            style={styles.socialBtn}
            onClick={() => handleSocialLogin(provider)}
            disabled={loading}
            aria-label={`${isSignup ? 'Sign up' : 'Sign in'} with ${label}`}
          >
            <span aria-hidden="true">{emoji}</span> {label}
          </button>
        ))}
      </div>

      <div style={styles.divider}><span>or</span></div>

      {/* Email / password form */}
      <form onSubmit={handleEmailAuth} noValidate>
        <label style={styles.label} htmlFor="auth-email">Email</label>
        <input
          id="auth-email"
          style={styles.input}
          type="email"
          value={email}
          onChange={handleEmailChange}
          placeholder="you@example.com"
          autoComplete="email"
          required
          aria-describedby={error ? errorId : undefined}
        />

        <label style={styles.label} htmlFor="auth-password">Password</label>
        <input
          id="auth-password"
          style={styles.input}
          type="password"
          value={password}
          onChange={handlePassChange}
          placeholder={isSignup ? 'Choose a strong password' : 'Your password'}
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          required
        />

        {/* Turnstile widget — shown only for signup */}
        {isSignup && (
          <div style={styles.turnstileWrap}>
            <div ref={turnstileRef} />
          </div>
        )}

        {/* Error message */}
        {error && (
          <p id={errorId} style={styles.error} role="alert">
            {error}
          </p>
        )}

        {/* Password reset confirmation */}
        {resetSent && (
          <p style={styles.success} role="status">
            ✅ Password reset email sent to {email}. Check your inbox.
          </p>
        )}

        <button
          type="submit"
          style={{ ...styles.submitBtn, opacity: loading ? 0.7 : 1 }}
          disabled={loading}
        >
          {loading
            ? (isSignup ? 'Creating account…' : 'Signing in…')
            : (isSignup ? 'Create account' : 'Sign in')}
        </button>

        {/* Forgot password — login mode only */}
        {!isSignup && (
          <button
            type="button"
            style={styles.forgotBtn}
            onClick={handleResetPassword}
            disabled={loading}
          >
            Forgot password?
          </button>
        )}
      </form>

      {isSignup && (
        <p style={styles.terms}>
          By creating an account you agree to our{' '}
          <a href="/terms" style={{ color: '#27ae60' }}>terms of service</a>.
        </p>
      )}

      {/* Toggle mode */}
      <button style={styles.toggleBtn} onClick={toggleMode} disabled={loading}>
        {isSignup
          ? 'Already have an account? Sign in'
          : "Don't have an account? Sign up free"}
      </button>
    </div>
  );
};

/* ── Human-readable Firebase error messages ── */
function friendlyError(code) {
  const map = {
    'auth/user-not-found':       'No account found with that email.',
    'auth/wrong-password':       'Incorrect password. Try again or reset it.',
    'auth/email-already-in-use': 'That email is already registered. Sign in instead.',
    'auth/weak-password':        'Password must be at least 6 characters.',
    'auth/invalid-email':        'Please enter a valid email address.',
    'auth/too-many-requests':    'Too many attempts. Please wait a few minutes.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/popup-closed-by-user': 'Sign-in window was closed. Please try again.',
  };
  return map[code] || null;
}

/* ── Inline styles ── */
const styles = {
  container: {
    maxWidth:      '400px',
    margin:        '40px auto',
    padding:       '32px 28px',
    background:    '#ffffff',
    borderRadius:  '14px',
    boxShadow:     '0 4px 24px rgba(0,0,0,0.10)',
    fontFamily:    '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    border:        '1px solid #A5D6A7',
  },
  heading: {
    margin:      '0 0 4px',
    fontSize:    '22px',
    color:       '#2E7D32',
    fontWeight:   700,
    textAlign:   'center',
  },
  sub: {
    margin:     '0 0 20px',
    fontSize:   '14px',
    color:      '#888',
    textAlign:  'center',
  },
  socialRow: {
    display:       'flex',
    gap:           '8px',
    marginBottom:  '16px',
  },
  socialBtn: {
    flex:          1,
    padding:       '10px 6px',
    fontSize:      '13px',
    fontWeight:     600,
    background:    '#f5f5f5',
    border:        '1px solid #ddd',
    borderRadius:  '8px',
    cursor:        'pointer',
    display:       'flex',
    alignItems:    'center',
    justifyContent:'center',
    gap:           '4px',
    transition:    'background 0.15s',
  },
  divider: {
    textAlign:    'center',
    fontSize:     '12px',
    color:        '#bbb',
    margin:       '0 0 16px',
    position:     'relative',
    overflow:     'hidden',
  },
  label: {
    display:      'block',
    fontSize:     '13px',
    fontWeight:    600,
    color:        '#555',
    marginBottom: '4px',
    marginTop:    '12px',
  },
  input: {
    width:         '100%',
    padding:       '11px 13px',
    fontSize:      '15px',
    border:        '1px solid #A5D6A7',
    borderRadius:  '8px',
    boxSizing:     'border-box',
    outline:       'none',
    color:         '#333',
    background:    '#fafafa',
    marginBottom:  '2px',
  },
  turnstileWrap: {
    margin: '14px 0',
  },
  error: {
    color:      '#e74c3c',
    fontSize:   '13px',
    margin:     '8px 0',
    fontWeight:  500,
  },
  success: {
    color:      '#27ae60',
    fontSize:   '13px',
    margin:     '8px 0',
    fontWeight:  500,
  },
  submitBtn: {
    display:       'block',
    width:         '100%',
    padding:       '13px',
    marginTop:     '14px',
    background:    '#4CAF50',
    color:         '#fff',
    border:        'none',
    borderRadius:  '8px',
    fontSize:      '15px',
    fontWeight:     700,
    cursor:        'pointer',
    transition:    'background 0.2s',
  },
  forgotBtn: {
    display:    'block',
    width:      '100%',
    marginTop:  '8px',
    padding:    '8px',
    background: 'none',
    border:     'none',
    color:      '#888',
    fontSize:   '13px',
    cursor:     'pointer',
    textAlign:  'center',
  },
  terms: {
    fontSize:  '12px',
    color:     '#aaa',
    textAlign: 'center',
    margin:    '12px 0 0',
  },
  toggleBtn: {
    display:    'block',
    width:      '100%',
    marginTop:  '16px',
    padding:    '10px',
    background: 'none',
    border:     '1.5px solid #A5D6A7',
    borderRadius:'8px',
    color:      '#2E7D32',
    fontSize:   '13px',
    fontWeight:  600,
    cursor:     'pointer',
    textAlign:  'center',
  },
};

export default Auth;
