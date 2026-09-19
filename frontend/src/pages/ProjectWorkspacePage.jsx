import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { 
  projectsAPI, dashboardAPI, apiConfigsAPI, issuesAPI, monitoringAPI 
} from '../api/client';
import HealthStatusCards from '../components/HealthStatusCards';
import ApiList from '../components/ApiList';
import MetricsCharts from '../components/MetricsCharts';
import { 
  FolderKanban, Server, AlertOctagon, BarChart3, Settings, Plus, RefreshCw, Trash2, Edit3, CheckCircle2 
} from 'lucide-react';

function ProjectWorkspacePage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { currentProject, selectProject, openApiModal, openProjectModal, openDriftViewer, openDiagnosisModal, refreshProjects } = useApp();

  const [project, setProject] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'apis', 'issues', 'monitoring', 'settings'
  const [summary, setSummary] = useState(null);
  const [apiConfigs, setApiConfigs] = useState([]);
  const [issues, setIssues] = useState([]);
  const [monitoringLogs, setMonitoringLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingApiId, setCheckingApiId] = useState(null);

  // Settings form
  const [projName, setProjName] = useState('');
  const [projDesc, setProjDesc] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);

  const loadWorkspace = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const proj = await projectsAPI.getById(projectId);
      setProject(proj);
      if (currentProject?.id !== proj.id) {
        selectProject(proj);
      }
      setProjName(prev => (prev === '' ? (proj.name || '') : prev));
      setProjDesc(prev => (prev === '' ? (proj.description || '') : prev));

      const [sum, configs, iss, logs] = await Promise.all([
        dashboardAPI.getSummary(projectId).catch(() => null),
        apiConfigsAPI.getAll(projectId).catch(() => []),
        issuesAPI.getAll({ project_id: projectId }).catch(() => []),
        monitoringAPI.getLogs({ project_id: projectId }).catch(() => [])
      ]);

      if (sum) setSummary(sum);
      if (configs) setApiConfigs(configs);
      if (iss) setIssues(iss);
      if (logs) setMonitoringLogs(logs);
    } catch (err) {
      console.error("Workspace load error:", err);
      if (err.response?.status === 403 || err.response?.status === 404) {
        alert("Project not found or authorization denied.");
        navigate('/projects');
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, currentProject?.id, selectProject, navigate]);

  useEffect(() => {
    loadWorkspace();
    const handleRefresh = () => loadWorkspace();
    window.addEventListener('api_cortex_refresh', handleRefresh);
    return () => window.removeEventListener('api_cortex_refresh', handleRefresh);
  }, [loadWorkspace]);

  const handleTriggerCheck = async (apiId) => {
    setCheckingApiId(apiId);
    try {
      await apiConfigsAPI.triggerCheck(apiId);
      await loadWorkspace();
    } catch (err) {
      alert(err.response?.data?.detail || "Manual check execution failed.");
    } finally {
      setCheckingApiId(null);
    }
  };

  const handleDeleteApi = async (apiId) => {
    if (window.confirm("Are you sure you want to delete this target API?")) {
      try {
        await apiConfigsAPI.delete(apiId);
        await loadWorkspace();
      } catch (err) {
        alert(err.response?.data?.detail || "Failed to delete API.");
      }
    }
  };

  const handleUpdateProjectSettings = async (e) => {
    e.preventDefault();
    setSettingsSaving(true);
    try {
      const updated = await projectsAPI.update(projectId, { name: projName, description: projDesc });
      setProject(updated);
      selectProject(updated);
      await refreshProjects();
      alert("Workspace settings saved successfully.");
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to update project settings.");
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (window.confirm(`Are you sure you want to permanently delete workspace '${project?.name}' and all its monitored APIs?`)) {
      try {
        await projectsAPI.delete(projectId);
        await refreshProjects();
        navigate('/projects');
      } catch (err) {
        alert(err.response?.data?.detail || "Failed to delete workspace.");
      }
    }
  };

  if (loading && !project) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading project workspace...
      </div>
    );
  }

  return (
    <div>
      {/* Workspace Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FolderKanban size={26} style={{ color: 'var(--accent-cyan)' }} />
            <h1 style={{ fontSize: '1.75rem', fontWeight: '700' }}>{project?.name}</h1>
            <span className="badge badge-purple" style={{ fontSize: '0.75rem' }}>Workspace #{project?.id}</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            {project?.description || 'Scoped workspace for isolated API monitoring and contract drift detection.'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button className="btn btn-secondary btn-sm" onClick={loadWorkspace}>
            <RefreshCw size={14} className={loading ? 'spin-loader' : ''} /> Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => openApiModal()}>
            <Plus size={14} /> Add Target API
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div style={{ display: 'flex', gap: '8px', background: 'rgba(15, 23, 42, 0.6)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '1.75rem', width: 'fit-content' }}>
        {[
          { id: 'overview', label: 'Overview', icon: FolderKanban },
          { id: 'apis', label: `APIs (${apiConfigs.length})`, icon: Server },
          { id: 'issues', label: `Issues (${issues.length})`, icon: AlertOctagon },
          { id: 'monitoring', label: 'Monitoring', icon: BarChart3 },
          { id: 'settings', label: 'Settings', icon: Settings }
        ].map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              <Icon size={16} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div>
          <HealthStatusCards summary={summary} />
          <MetricsCharts monitoringLogs={monitoringLogs} issues={issues} />
          <ApiList 
            apiConfigs={apiConfigs}
            onEdit={(cfg) => openApiModal(cfg)}
            onDelete={handleDeleteApi}
            onTriggerCheck={handleTriggerCheck}
            checkingApiId={checkingApiId}
          />
        </div>
      )}

      {/* TAB 2: APIS */}
      {activeTab === 'apis' && (
        <ApiList 
          apiConfigs={apiConfigs}
          onEdit={(cfg) => openApiModal(cfg)}
          onDelete={handleDeleteApi}
          onTriggerCheck={handleTriggerCheck}
          checkingApiId={checkingApiId}
        />
      )}

      {/* TAB 3: ISSUES */}
      {activeTab === 'issues' && (
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertOctagon size={18} style={{ color: 'var(--status-danger)' }} />
            Issues & Schema Drift in {project?.name}
          </h3>

          {issues.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--status-success)', fontSize: '0.9rem' }}>
              <CheckCircle2 size={32} style={{ margin: '0 auto 0.5rem auto' }} />
              No issues detected under this workspace!
            </div>
          ) : (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Issue ID & Type</th>
                    <th>Target API</th>
                    <th>Error Summary</th>
                    <th>Status</th>
                    <th>Detected</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.map(iss => (
                    <tr key={iss.id}>
                      <td>
                        <span className="badge badge-danger" style={{ fontSize: '0.68rem' }}>{iss.issue_type}</span>
                        <div style={{ fontWeight: '600', fontSize: '0.85rem', marginTop: '2px' }}>#{iss.id}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: '600' }}>{iss.api_name || `API #${iss.api_config_id}`}</div>
                        <div className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{iss.api_url}</div>
                      </td>
                      <td style={{ maxWidth: '280px' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{iss.error_details}</div>
                      </td>
                      <td>
                        <span className={`badge ${iss.status === 'DIAGNOSED' ? 'badge-purple' : 'badge-warning'}`}>
                          {iss.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(iss.created_at).toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openDriftViewer(iss)}>
                          Drift Diff
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: MONITORING */}
      {activeTab === 'monitoring' && (
        <div>
          <MetricsCharts monitoringLogs={monitoringLogs} issues={issues} />
          <div className="glass-card" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '600', marginBottom: '1rem' }}>Recent Monitoring History Logs</h3>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Log ID</th>
                    <th>Status Code</th>
                    <th>Response Time</th>
                    <th>Health</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {monitoringLogs.slice(0, 15).map(log => (
                    <tr key={log.id}>
                      <td>#{log.id}</td>
                      <td>
                        <span className={`badge ${log.status_code >= 200 && log.status_code < 300 ? 'badge-success' : 'badge-danger'}`}>
                          HTTP {log.status_code || 'N/A'}
                        </span>
                      </td>
                      <td className="font-mono">{Math.round(log.response_time_ms)} ms</td>
                      <td>
                        <span className={`badge ${log.is_healthy ? 'badge-success' : 'badge-danger'}`}>
                          {log.is_healthy ? 'HEALTHY' : 'FAILED'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: SETTINGS */}
      {activeTab === 'settings' && (
        <div className="glass-card" style={{ padding: '1.75rem', maxWidth: '600px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1.25rem' }}>
            Workspace Settings
          </h3>
          <form onSubmit={handleUpdateProjectSettings}>
            <div className="form-group">
              <label className="form-label">Project Workspace Name *</label>
              <input 
                type="text" 
                className="form-input" 
                value={projName}
                onChange={(e) => setProjName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea 
                className="form-textarea" 
                value={projDesc}
                onChange={(e) => setProjDesc(e.target.value)}
                style={{ minHeight: '80px', fontFamily: 'var(--font-sans)' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <button type="button" className="btn btn-danger btn-sm" onClick={handleDeleteWorkspace}>
                <Trash2 size={14} /> Delete Workspace
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={settingsSaving}>
                {settingsSaving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}

export default ProjectWorkspacePage;
