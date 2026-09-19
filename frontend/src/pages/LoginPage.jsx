import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Activity, Lock, Mail, User, AlertCircle, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';

function LoginPage() {
  const { login, register, refreshUser, refreshProjects, selectProject } = useApp();
  const navigate = useNavigate();

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        await register(email, password, fullName);
      } else {
        await login(email, password);
      }
      setLoading(false);
      navigate('/dashboard');
    } catch (err) {
      setLoading(false);
      const status = err.response?.status;
      let msg = err.response?.data?.detail || err.message || "Authentication failed.";
      if (status === 401) msg = "Invalid email or password. Please check credentials.";
      if (status === 403) msg = "Account access forbidden.";
      if (status === 429) msg = "Too many login attempts. Please wait a moment.";
      if (status === 502 || status === 504) msg = "Backend server unreachable. Verify FastAPI is running.";
      setError(msg);
    }
  };

  const handleDevLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      try {
        await login('admin@apicortex.io', 'admin123');
      } catch (err) {
        await register('admin@apicortex.io', 'admin123', 'Default Admin');
      }
      setLoading(false);
      navigate('/dashboard');
    } catch (err) {
      setLoading(false);
      setError("Dev auto-login failed. Ensure FastAPI backend & PostgreSQL are running.");
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      backgroundImage: `
        radial-gradient(at 20% 20%, rgba(0, 242, 254, 0.15) 0px, transparent 50%),
        radial-gradient(at 80% 80%, rgba(139, 92, 246, 0.15) 0px, transparent 50%)
      `
    }}>
      <div className="glass-card" style={{ maxWidth: '440px', width: '100%', padding: '2rem' }}>
        
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#040914',
            margin: '0 auto 0.75rem auto',
            boxShadow: '0 0 20px rgba(0, 242, 254, 0.4)'
          }}>
            <Activity size={26} strokeWidth={2.5} />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700', letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #ffffff 30%, var(--accent-cyan) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            API Cortex
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Intelligent API Health & Schema Drift Platform
          </p>
        </div>

        {/* Tab Toggle */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'rgba(15, 23, 42, 0.6)', padding: '4px', borderRadius: '8px', marginBottom: '1.25rem' }}>
          <button 
            type="button"
            className="btn btn-sm" 
            style={{ background: !isRegister ? 'rgba(255, 255, 255, 0.1)' : 'transparent', color: !isRegister ? 'var(--text-primary)' : 'var(--text-muted)' }}
            onClick={() => { setIsRegister(false); setError(null); }}
          >
            Sign In
          </button>
          <button 
            type="button"
            className="btn btn-sm" 
            style={{ background: isRegister ? 'rgba(255, 255, 255, 0.1)' : 'transparent', color: isRegister ? 'var(--text-primary)' : 'var(--text-muted)' }}
            onClick={() => { setIsRegister(true); setError(null); }}
          >
            Register
          </button>
        </div>

        {error && (
          <div style={{ padding: '0.75rem 0.9rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: 'var(--status-danger)', fontSize: '0.825rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Jane Doe" 
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required={isRegister}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input 
              type="email" 
              className="form-input" 
              placeholder="name@company.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input 
              type="password" 
              className="form-input" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
            {loading ? 'Authenticating...' : isRegister ? 'Create Account' : 'Sign In'}
          </button>

          {/* Dev Quick Auto-Login */}
          <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <button 
              type="button" 
              className="btn btn-secondary btn-sm" 
              style={{ width: '100%', fontSize: '0.8rem', gap: '6px' }}
              onClick={handleDevLogin}
              disabled={loading}
            >
              <Lock size={14} style={{ color: 'var(--accent-cyan)' }} />
              Quick Dev Auto-Login (admin@apicortex.io)
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

export default LoginPage;
