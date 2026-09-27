import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Menu, Search, Plus, FolderKanban, Activity, ExternalLink, ShieldCheck, ChevronDown, Bell, Sun, Moon, User 
} from 'lucide-react';
import { useApp } from '../context/AppContext';

function TopBar({ onToggleMobile }) {
  const { 
    projects, currentProject, selectProject, openProjectModal, openApiModal, systemHealth, logout, user 
  } = useApp();
  const navigate = useNavigate();

  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(true);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.body.classList.toggle('light-theme');
  };

  const handleProjectChange = (e) => {
    const val = e.target.value;
    if (val === '__new__') {
      openProjectModal();
      return;
    }
    if (val === '__all__') {
      selectProject(null);
      return;
    }
    const found = projects.find(p => String(p.id) === String(val));
    if (found) selectProject(found);
  };

  return (
    <header className="app-topbar">
      
      {/* Left side: Hamburger & Project selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button 
          className="btn btn-secondary btn-sm"
          onClick={onToggleMobile}
          style={{ display: 'none', padding: '0.4rem' }}
          id="mobile-menu-toggle"
        >
          <Menu size={18} />
        </button>


      </div>

      {/* Right side: Actions, Health, Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        
        {/* Theme Toggle */}
        <button 
          className="btn btn-secondary btn-sm" 
          onClick={toggleTheme}
          style={{ padding: '0.4rem', borderRadius: '50%' }}
          title="Toggle Theme"
        >
          {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Notification Bell */}
        <div style={{ position: 'relative' }}>
          <button 
            className="btn btn-secondary btn-sm"
            style={{ padding: '0.4rem', borderRadius: '50%', position: 'relative' }}
            title="Notifications"
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfileMenu(false); // Close profile if open
            }}
          >
            <Bell size={16} />
            {hasUnreadNotifications && (
              <span style={{
                position: 'absolute',
                top: '0',
                right: '0',
                width: '8px',
                height: '8px',
                background: 'var(--status-danger)',
                borderRadius: '50%',
                border: '2px solid var(--bg-primary)'
              }}></span>
            )}
          </button>

          {showNotifications && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: '-50px',
              marginTop: '0.5rem',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '0.5rem 0',
              width: '280px',
              zIndex: 10,
              boxShadow: 'var(--shadow-lg)'
            }}>
              <div style={{ padding: '0.5rem 1rem', fontWeight: '600', borderBottom: '1px solid var(--border-color)' }}>
                Notifications
              </div>
              <div style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {hasUnreadNotifications ? (
                  <div>
                    <div style={{ marginBottom: '0.5rem' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>System Update</strong><br />
                      All API endpoints are currently healthy and responding normally.
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>Welcome to API Cortex</strong><br />
                      Your dashboard is ready. Try registering a new target API to start monitoring!
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '1rem 0' }}>No new notifications</div>
                )}
              </div>
              {hasUnreadNotifications && (
                <div 
                  style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--accent-cyan)', textAlign: 'center', borderTop: '1px solid var(--border-color)' }}
                  onClick={() => setHasUnreadNotifications(false)}
                  className="dropdown-item"
                >
                  Mark all as read
                </div>
              )}
            </div>
          )}
        </div>

        {/* System Health Ping */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(15, 23, 42, 0.8)',
          padding: '5px 12px',
          borderRadius: '20px',
          border: '1px solid var(--border-color)',
          fontSize: '0.78rem'
        }}>
          <span className="pulse-dot" style={{ background: systemHealth?.database === 'healthy' ? 'var(--status-success)' : 'var(--status-danger)' }} />
          <span style={{ color: 'var(--text-secondary)' }}>System:</span>
          <strong style={{ color: systemHealth?.status === 'healthy' ? 'var(--status-success)' : 'var(--status-danger)' }}>
            {systemHealth?.status ? systemHealth.status.toUpperCase() : 'ONLINE'}
          </strong>
        </div>

        {/* User Profile */}
        <div style={{ position: 'relative' }}>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowNotifications(false); // Close notifications if open
            }}
            style={{ padding: '0.4rem 0.8rem', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff'
            }}>
              <User size={14} />
            </div>
            <span style={{ fontSize: '0.85rem' }}>{user?.full_name || 'Admin'}</span>
            <ChevronDown size={14} />
          </button>

          {showProfileMenu && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '0.5rem',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '0.5rem 0',
              minWidth: '150px',
              zIndex: 10,
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
            }}>
              <div 
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', cursor: 'pointer' }} 
                className="dropdown-item"
                onClick={() => { setShowProfileMenu(false); navigate('/settings'); }}
              >
                Profile
              </div>
              <div 
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', cursor: 'pointer' }} 
                className="dropdown-item"
                onClick={() => { setShowProfileMenu(false); navigate('/settings'); }}
              >
                Settings
              </div>
              <div style={{ borderTop: '1px solid var(--border-color)', margin: '0.25rem 0' }}></div>
              <div 
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--status-danger)' }} 
                className="dropdown-item"
                onClick={() => { setShowProfileMenu(false); if (logout) logout(); }}
              >
                Logout
              </div>
            </div>
          )}
        </div>

      </div>

    </header>
  );
}

export default TopBar;
