import React from 'react';
import { Activity, ShieldCheck, Database, User, LogOut, Terminal, Layers } from 'lucide-react';

function Navbar({ user, systemHealth, activeProject, onOpenAuth, onLogout, onOpenNewApi }) {
  return (
    <header className="glass-card" style={{ padding: '1rem 1.75rem', marginBottom: '2rem', borderRadius: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        
        {/* Brand Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#040914',
            boxShadow: '0 0 16px rgba(0, 242, 254, 0.35)'
          }}>
            <Activity size={24} strokeWidth={2.5} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{
                fontSize: '1.4rem',
                fontWeight: '700',
                letterSpacing: '-0.02em',
                background: 'linear-gradient(135deg, #ffffff 30%, var(--accent-cyan) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                API Cortex
              </h1>
              <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>v1.0 Pro</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              API Health Monitoring & Schema Drift Platform
            </p>
          </div>
        </div>

        {/* Status Pings & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          
          {/* Health Indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(15, 23, 42, 0.8)',
            padding: '6px 14px',
            borderRadius: '20px',
            border: '1px solid var(--border-color)',
            fontSize: '0.8rem'
          }}>
            <span className={systemHealth?.database === 'healthy' ? 'pulse-dot' : 'pulse-dot'} 
                  style={{ background: systemHealth?.database === 'healthy' ? 'var(--status-success)' : 'var(--status-danger)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>System Engine:</span>
            <strong style={{ color: systemHealth?.status === 'healthy' ? 'var(--status-success)' : 'var(--status-danger)' }}>
              {systemHealth?.status ? systemHealth.status.toUpperCase() : 'CONNECTING...'}
            </strong>
          </div>

          {/* New API Button */}
          <button className="btn btn-primary" onClick={onOpenNewApi}>
            + Monitored API
          </button>

          {/* User Auth Profile */}
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                fontSize: '0.85rem'
              }}>
                <User size={16} className="text-cyan" style={{ color: 'var(--accent-cyan)' }} />
                <span>{user.full_name || user.email}</span>
              </div>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={onLogout}
                title="Log Out"
                style={{ padding: '0.5rem' }}
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button className="btn btn-secondary" onClick={onOpenAuth}>
              <User size={16} /> Sign In
            </button>
          )}

        </div>

      </div>
    </header>
  );
}

export default Navbar;
