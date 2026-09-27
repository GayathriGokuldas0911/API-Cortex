import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  Activity, LayoutDashboard, FolderKanban, Server, AlertOctagon, 
  BarChart3, Settings, LogOut, User, Sparkles, X 
} from 'lucide-react';
import { useApp } from '../context/AppContext';

function Sidebar({ mobileOpen, onCloseMobile }) {
  const { user, logout } = useApp();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className={`app-sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      
      {/* Brand Header */}
      <div className="sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#040914',
              boxShadow: '0 0 14px rgba(0, 242, 254, 0.4)'
            }}>
              <Activity size={20} strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontSize: '1.15rem', fontWeight: '700', letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #ffffff 30%, var(--accent-cyan) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                API Cortex
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                API Health & Drift Platform
              </div>
            </div>
          </div>

          {/* Close mobile button */}
          {mobileOpen && (
            <button className="btn btn-secondary btn-sm" onClick={onCloseMobile} style={{ padding: '0.25rem' }}>
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={() => { if (onCloseMobile) onCloseMobile(); }}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Sidebar Footer User Info */}
      <div className="sidebar-footer">
        {user ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.75rem' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-cyan)',
                border: '1px solid var(--border-color)'
              }}>
                <User size={16} />
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {user.full_name || 'Authorized User'}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {user.email}
                </div>
              </div>
            </div>

            <button 
              className="btn btn-secondary btn-sm" 
              style={{ width: '100%', fontSize: '0.8rem', gap: '6px' }}
              onClick={handleLogout}
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        ) : (
          <button 
            className="btn btn-primary btn-sm" 
            style={{ width: '100%', fontSize: '0.8rem' }}
            onClick={() => navigate('/login')}
          >
            Sign In
          </button>
        )}
      </div>

    </aside>
  );
}

export default Sidebar;
