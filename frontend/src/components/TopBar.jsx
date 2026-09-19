import React from 'react';
import { 
  Menu, Search, Plus, FolderKanban, Activity, ExternalLink, ShieldCheck, ChevronDown 
} from 'lucide-react';
import { useApp } from '../context/AppContext';

function TopBar({ onToggleMobile }) {
  const { 
    projects, currentProject, selectProject, openProjectModal, openApiModal, systemHealth 
  } = useApp();

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

        {/* Project Selector Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FolderKanban size={18} style={{ color: 'var(--accent-cyan)' }} />
          <div style={{ position: 'relative' }}>
            <select
              className="form-select"
              style={{
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '0.4rem 2rem 0.4rem 0.85rem',
                fontSize: '0.85rem',
                fontWeight: '600',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                appearance: 'none'
              }}
              value={currentProject ? currentProject.id : '__all__'}
              onChange={handleProjectChange}
            >
              <option value="__all__">🌐 All Workspaces ({projects.length})</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>📁 {p.name}</option>
              ))}
              <option value="__new__">➕ Create New Workspace...</option>
            </select>
            <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
          </div>
        </div>

        {/* Quick New Project Button */}
        <button 
          className="btn btn-secondary btn-sm" 
          onClick={() => openProjectModal()}
          title="Create New Project Workspace"
          style={{ padding: '0.4rem 0.6rem', fontSize: '0.78rem', gap: '4px' }}
        >
          <Plus size={14} /> Project
        </button>
      </div>

      {/* Right side: Health, Grafana link, and Action button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        
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

        {/* Open Grafana Link */}
        <a 
          href="http://localhost:3000" 
          target="_blank" 
          rel="noopener noreferrer"
          className="btn btn-secondary btn-sm"
          title="Open Grafana Dashboards"
          style={{ fontSize: '0.78rem', gap: '6px', padding: '0.4rem 0.75rem' }}
        >
          <ExternalLink size={13} style={{ color: 'var(--accent-purple)' }} />
          <span>Grafana</span>
        </a>

        {/* "+ Monitored API" Button */}
        <button 
          className="btn btn-primary btn-sm"
          onClick={() => openApiModal()}
          style={{ gap: '6px', padding: '0.45rem 0.9rem' }}
        >
          <Plus size={15} />
          <span>Monitored API</span>
        </button>

      </div>

    </header>
  );
}

export default TopBar;
