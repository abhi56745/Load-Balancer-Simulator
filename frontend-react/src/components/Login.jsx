import React, { useState } from 'react';
import api from '../lib/api';
import BackgroundScene from './BackgroundScene';

const Login = ({ onLoginSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const payload = isRegister ? { username, email, password } : { username, password };
      const response = await api.post(endpoint, payload);

      onLoginSuccess(response.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell auth-shell">
      <BackgroundScene mode="auth" />

      <div className="glass auth-card auth-form-card">
        <h2 style={{ marginBottom: '8px' }}>
          {isRegister ? 'Create Account' : 'Welcome Back'}
        </h2>
        <p style={{ color: '#94a3b8', marginBottom: '24px' }}>
          {isRegister ? 'Sign up for Load Balancer Simulator' : 'Sign in to access your dashboard'}
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              className="ctrl-select"
              style={{ width: '100%', padding: '12px' }}
            />
          </div>
          {isRegister && (
            <div>
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="ctrl-select"
                style={{ width: '100%', padding: '12px' }}
              />
            </div>
          )}
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="ctrl-select"
              style={{ width: '100%', padding: '12px' }}
            />
          </div>

          {error && (
            <div style={{ color: '#ff0055', fontSize: '0.9rem' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-run btn-ripple"
            disabled={loading}
            style={{ justifyContent: 'center', padding: '12px', marginTop: '8px' }}
          >
            {loading ? <span className="spinner" /> : (isRegister ? 'Register' : 'Login')}
          </button>
        </form>

        <p style={{ marginTop: '24px', fontSize: '0.9rem', color: '#64748b' }}>
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
            style={{ background: 'none', border: 'none', color: '#00ffff', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}
          >
            {isRegister ? 'Login here' : 'Register here'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;
