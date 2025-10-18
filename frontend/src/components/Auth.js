// src/components/Auth.js
import React, { useState } from 'react';
import { auth, googleProvider, facebookProvider, twitterProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from '../firebase';

const Auth = ({ onAuthChange }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [error, setError] = useState('');

  const handleSocialLogin = async (provider) => {
    try {
      const result = await signInWithPopup(auth, provider);
      onAuthChange(result.user);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    if (!turnstileToken) {
      setError('Please complete the human verification.');
      return;
    }
    try {
      setError('');
      if (isSignup) {
        // Verify Turnstile token (client-side; in prod, send to backend for secret validation)
        if (turnstileToken) {
          await createUserWithEmailAndPassword(auth, email, password);
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onAuthChange({ email }); // Simplified; use actual user object
    } catch (err) {
      setError(err.message);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    try {
      await sendPasswordResetEmail(auth, email);
      alert('Password reset email sent!');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-container">
      <h2>{isSignup ? 'Sign Up' : 'Log In'}</h2>
      <button onClick={() => handleSocialLogin(googleProvider)}>Sign {isSignup ? 'up' : 'in'} with Google</button>
      <button onClick={() => handleSocialLogin(facebookProvider)}>Sign {isSignup ? 'up' : 'in'} with Facebook</button>
      <button onClick={() => handleSocialLogin(twitterProvider)}>Sign {isSignup ? 'up' : 'in'} with X (Twitter)</button>
      
      <form onSubmit={handleEmailAuth}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />
        <div className="turnstile" data-sitekey="your-turnstile-sitekey"></div>
        <button type="submit">{isSignup ? 'Sign Up' : 'Log In'}</button>
        <button type="button" onClick={handleResetPassword}>Forgot Password?</button>
      </form>
      
      {isSignup && <p>By signing up, you agree to our terms.</p>}
      <button onClick={() => setIsSignup(!isSignup)}>
        {isSignup ? 'Already have an account? Log In' : 'Need an account? Sign Up'}
      </button>
      
      {error && <p className="error">{error}</p>}
      
      <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
      <script dangerouslySetInnerHTML={{
        __html: `
          window.turnstileCallback = function(token) {
            document.getElementById('turnstile-token').value = token;
            setTurnstileToken(token);
          };
        `
      }} />
      <input type="hidden" id="turnstile-token" />
    </div>
  );
};

export default Auth;
