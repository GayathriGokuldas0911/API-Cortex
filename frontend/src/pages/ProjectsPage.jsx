import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FolderKanban, Plus, Server, AlertOctagon, CheckCircle2, ArrowRight, Clock, ShieldCheck, Trash2, Edit3 
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { projectsAPI, dashboardAPI, apiConfigsAPI } from '../api/client';

function ProjectsPage() {
  const { projects, refreshProjects, selectProject, openProjectModal } = useApp();
  const navigate = useNavigate();

  const [projectStats, setProjectStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllProjectStats();
  }, [projects]);

  const loadAllProjectStats = async () => {
    setLoading(true);
    try {
      const stats = {};
      for (const proj of projects) {
        try {
          const [sum, apis] = await Promise.all([
            dashboardAPI.getSummary(proj.id).catch(() => null),
            apiConfigsAPI.getAll(proj.id).catch(() => [])
          ]);
          stats[proj.id] = {
            totalApis: apis?.length || 0,
            availability: sum?.availability_percentage ?? 100.0,
            unresolvedIssues: sum?.unresolved_issues ?? 0,
            unhealthyApis: sum?.unhealthy_apis ?? 0
          };
        } catch (err) {
          stats[proj.id] = { totalApis: 0, availability: 100.0, unresolvedIssues: 0, unhealthyApis: 0 };
        }
      }
      setProjectStats(stats);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenWorkspace = (proj) => {
    selectProject(proj);
    navigate(`/projects/${proj.id}`);
  };

  const handleDeleteProject = async (e, projId) => {
    e.stopPropagation();
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FolderKanban size={26} style={{ color: 'var(--accent-cyan)' }} />
            <h1 style={{ fontSize: '1.75rem', fontWeight: '700' }}>Project Workspaces</h1>
            <span className="badge badge-purple" style={{ fontSize: '0.75rem' }}>{projects.length} Total</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Multi-tenant project boundaries isolating monitored APIs, schemas, and AI diagnostics.
          </p>
        </div>

        <button 
          className="btn btn-primary"
          onClick={() => openProjectModal()}
        >
          <Plus size={16} /> + New Project
        </button>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <div style={{
            width: '40px', height: '40px', border: '3px solid rgba(0, 242, 254, 0.2)',
            borderTopColor: 'var(--accent-cyan)', borderRadius: '50%', animation: 'spin 1s linear infinite'
          }}></div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : projects.length === 0 ? (
        <div className="glass-card" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'rgba(0, 242, 254, 0.1)',
            color: 'var(--accent-cyan)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem auto'
          }}>
            <FolderKanban size={30} />
          </div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '0.5rem' }}>No projects found.</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto 1.5rem auto' }}>
            Click '+ New Project' to get started.
          </p>
          <button className="btn btn-primary" onClick={() => openProjectModal()}>
            <Plus size={16} /> + New Project
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.5rem'
        }}>
          {projects.map(proj => {
            const st = projectStats[proj.id] || { totalApis: 0, availability: 100.0, unresolvedIssues: 0, unhealthyApis: 0 };
            const isHealthy = st.unresolvedIssues === 0 && st.unhealthyApis === 0;

            return (
              <div 
                key={proj.id}
                className="glass-card glass-card-interactive"
                style={{ padding: '1.5rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                onClick={() => handleOpenWorkspace(proj)}
              >
                <div>
                  {/* Top Bar inside Card */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <span className={`badge ${isHealthy ? 'badge-success' : 'badge-danger'}`} style={{ gap: '4px' }}>
                      {isHealthy ? <CheckCircle2 size={12} /> : <AlertOctagon size={12} />}
                      {isHealthy ? 'HEALTHY' : `${st.unresolvedIssues} ISSUES`}
                    </span>
                    <button 
                      className="btn btn-danger btn-sm"
                      onClick={(e) => handleDeleteProject(e, proj.id)}
                      title="Delete Project Workspace"
                      style={{ padding: '0.25rem 0.45rem', opacity: 0.8 }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                    {proj.name}
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', minHeight: '40px', lineHeight: '1.4' }}>
                    {proj.description || 'No description provided.'}
                  </p>
                </div>

                {/* Metrics Breakdown inside Card */}
                <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                    
                    <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.6rem 0.75rem', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>TARGET APIS</span>
                      <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {st.totalApis}
                      </div>
                    </div>

                    <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.6rem 0.75rem', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>AVAILABILITY</span>
                      <div style={{ fontSize: '1.1rem', fontWeight: '700', color: st.availability >= 95 ? 'var(--status-success)' : 'var(--status-warning)' }}>
                        {st.availability.toFixed(1)}%
                      </div>
                    </div>

                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>Created: {new Date(proj.created_at).toLocaleDateString()}</span>
                    <span style={{ color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
                      Open Workspace <ArrowRight size={13} />
                    </span>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

export default ProjectsPage;
