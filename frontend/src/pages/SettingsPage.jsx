import React, { useState } from 'react';
import { 
  Settings, User, FolderKanban, Activity, ShieldCheck, Database, Cpu, Plus, Trash2, Edit3 
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { projectsAPI } from '../api/client';

function SettingsPage() {
  const { user, projects, refreshProjects, systemHealth, openProjectModal } = useApp();
  const [activeSection, setActiveSection] = useState('profile'); // 'profile', 'projects', 'system'

  const handleDeleteProject = async (projId) => {
    if (window.confirm("Are you sure you want to delete this project workspace? All associated APIs and logs will be permanently deleted.")) {
      try {
        await projectsAPI.delete(projId);
        await refreshProjects();
      } catch (err) {
        alert(err.response?.data?.detail || "Failed to delete project.");
      }
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Settings size={26} style={{ color: 'var(--accent-cyan)' }} />
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700' }}>Platform Settings</h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Manage your account profile, project workspaces, and view backend system status.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', background: 'rgba(15, 23, 42, 0.6)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '1.75rem', width: 'fit-content' }}>
        <button
          className={`tab-btn ${activeSection === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveSection('profile')}
        >
          <User size={15} /> Profile
        </button>

        <button
          className={`tab-btn ${activeSection === 'projects' ? 'active' : ''}`}
          onClick={() => setActiveSection('projects')}
        >
          <FolderKanban size={15} /> Workspaces ({projects.length})
        </button>

        <button
          className={`tab-btn ${activeSection === 'system' ? 'active' : ''}`}
          onClick={() => setActiveSection('system')}
        >
          <Activity size={15} /> System & Engine
        </button>
      </div>

      {/* SECTION 1: PROFILE */}
      {activeSection === 'profile' && (
        <div className="glass-card" style={{ padding: '1.75rem', maxWidth: '650px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: '600', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={18} style={{ color: 'var(--accent-cyan)' }} />
            User Account Profile
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1rem', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>FULL NAME</span>
              <p style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                {user?.full_name || 'N/A'}
              </p>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1rem', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>EMAIL ADDRESS</span>
              <p style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                {user?.email || 'N/A'}
              </p>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1rem', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>USER IDENTIFIER</span>
              <p style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', marginTop: '0.2rem' }} className="font-mono">
                UID #{user?.id || 'N/A'}
              </p>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ACCOUNT STATUS</span>
                <p style={{ fontSize: '0.9rem', fontWeight: '600', color: user?.is_active ? 'var(--status-success)' : 'var(--status-danger)', marginTop: '0.2rem' }}>
                  {user?.is_active ? 'ACTIVE & VERIFIED' : 'INACTIVE'}
                </p>
              </div>
              <span className="badge badge-success">JWT Authenticated</span>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: WORKSPACES */}
      {activeSection === 'projects' && (
        <div className="glass-card" style={{ padding: '1.75rem', maxWidth: '750px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FolderKanban size={18} style={{ color: 'var(--accent-cyan)' }} />
              Workspace Management
            </h3>
            <button className="btn btn-primary btn-sm" onClick={() => openProjectModal()}>
              <Plus size={14} /> + New Workspace
            </button>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Workspace Name</th>
                  <th>Description</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {projects.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: '600' }}>{p.name}</td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{p.description || '—'}</td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteProject(p.id)}
                        style={{ padding: '0.25rem 0.5rem' }}
                        title="Delete Workspace"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 3: SYSTEM */}
      {activeSection === 'system' && (
        <div className="glass-card" style={{ padding: '1.75rem', maxWidth: '700px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: '600', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} style={{ color: 'var(--accent-cyan)' }} />
            System Status & Backend Telemetry
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1rem', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CORE FASTAPI APP</span>
              <p style={{ fontSize: '1rem', fontWeight: '700', marginTop: '0.2rem', color: 'var(--text-primary)' }}>
                {systemHealth?.app_name || 'API Cortex Engine'}
              </p>
              <span className="badge badge-success" style={{ marginTop: '0.4rem', fontSize: '0.65rem' }}>v1.0.0</span>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1rem', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>POSTGRESQL DATABASE</span>
              <p style={{ fontSize: '1rem', fontWeight: '700', marginTop: '0.2rem', color: systemHealth?.database === 'healthy' ? 'var(--status-success)' : 'var(--status-danger)' }}>
                {systemHealth?.database ? systemHealth.database.toUpperCase() : 'CONNECTING...'}
              </p>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Port 5432 / SQLAlchemy ORM</span>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1rem', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>AI DIAGNOSTIC MODEL</span>
              <p style={{ fontSize: '1rem', fontWeight: '700', marginTop: '0.2rem', color: 'var(--accent-purple)' }}>
                gemini-3.6-flash
              </p>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Google GenAI SDK Native</span>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1rem', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PROMETHEUS EXPORTER</span>
              <p style={{ fontSize: '1rem', fontWeight: '700', marginTop: '0.2rem', color: 'var(--accent-cyan)' }}>
                /metrics Active
              </p>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Scraped every 15s</span>
            </div>

          </div>

          <div style={{ background: 'rgba(0, 242, 254, 0.05)', border: '1px solid rgba(0, 242, 254, 0.2)', padding: '1rem', borderRadius: '8px', fontSize: '0.85rem' }}>
            <strong style={{ color: 'var(--accent-cyan)' }}>Zero-Docker Architecture:</strong> All services run natively on host machine. PostgreSQL manages relational contract states; Prometheus scrapes time-series metrics from FastAPI; Grafana serves analytical dashboards.
          </div>
        </div>
      )}

    </div>
  );
}

export default SettingsPage;
