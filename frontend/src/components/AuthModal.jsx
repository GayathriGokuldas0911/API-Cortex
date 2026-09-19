import React, { useState } from 'react';
import { X, Lock, Mail, User, Shield, ArrowRight, AlertCircle } from 'lucide-react';
import { authAPI } from '../api/client';

function AuthModal({ isOpen, onClose, onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        await authAPI.register(email, password, fullName);
        await authAPI.login(email, password);
      } else {
        await authAPI.login(email, password);
      }
      setLoading(false);
      onLoginSuccess();
      onClose();
    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.detail || err.message || "Authentication failed");
    }
  };

  const handleDevLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      try {
        await authAPI.login('admin@apicortex.io', 'admin123');
      } catch (err) {
        await authAPI.register('admin@apicortex.io', 'admin123', 'Default Admin');
        await authAPI.login('admin@apicortex.io', 'admin123');
      }
      setLoading(false);
      onLoginSuccess();
      onClose();
    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.detail || "Dev auto-login failed. Verify backend PostgreSQL DB connection.");
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '440px', padding: '1.75rem' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield size={22} style={{ color: 'var(--accent-cyan)' }} />
            <h2 style={{ fontSize: '1.2rem', fontWeight: '600' }}>
              {isRegister ? 'Create API Cortex Account' : 'Sign In to API Cortex'}
            </h2>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: '0.35rem 0.5rem' }}>
            <X size={18} />
          </button>
        </div>

        {/* Tab Toggle */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'rgba(15, 23, 42, 0.6)', padding: '4px', borderRadius: '8px', marginBottom: '1.25rem' }}>
          <button 
            type="button"
            className="btn btn-sm" 
            style={{ background: !isRegister ? 'rgba(255, 255, 255, 0.1)' : 'transparent', color: !isRegister ? 'var(--text-primary)' : 'var(--text-muted)' }}
            onClick={() => { setIsRegister(false); setError(null); }}
          >
            Log In
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
          <div style={{ padding: '0.75rem 0.9rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: 'var(--status-danger)', fontSize: '0.825rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
              placeholder="user@example.com" 
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
            {loading ? 'Authenticating...' : isRegister ? 'Register Account' : 'Sign In'}
          </button>

          {/* Dev Quick Login Button */}
          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
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

export default AuthModal;
