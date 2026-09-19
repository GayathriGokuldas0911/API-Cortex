import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import HealthStatusCards from '../components/HealthStatusCards';
import MetricsCharts from '../components/MetricsCharts';
import { 
  dashboardAPI, apiConfigsAPI, issuesAPI, monitoringAPI 
} from '../api/client';
import { 
  RefreshCw, Server, AlertOctagon, Eye, Sparkles, Plus, CheckCircle2, Clock, ExternalLink 
} from 'lucide-react';
import { Link } from 'react-router-dom';

function DashboardPage() {
  const { currentProject, openApiModal, openDriftViewer, openDiagnosisModal } = useApp();

  const [summary, setSummary] = useState(null);
  const [apiConfigs, setApiConfigs] = useState([]);
  const [issues, setIssues] = useState([]);
  const [monitoringLogs, setMonitoringLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingApiId, setCheckingApiId] = useState(null);
  const [diagnosingIssueId, setDiagnosingIssueId] = useState(null);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    const projId = currentProject?.id || null;
    try {
      const [sum, configs, iss, logs] = await Promise.all([
        dashboardAPI.getSummary(projId).catch(() => null),
        apiConfigsAPI.getAll(projId).catch(() => []),
        issuesAPI.getAll(projId ? { project_id: projId } : {}).catch(() => []),
        monitoringAPI.getLogs(projId ? { project_id: projId } : {}).catch(() => [])
      ]);

      if (sum) setSummary(sum);
      if (configs) setApiConfigs(configs);
      if (iss) setIssues(iss);
      if (logs) setMonitoringLogs(logs);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

  useEffect(() => {
    loadDashboardData();

    // Auto-refresh event listener
    const handleCustomRefresh = () => loadDashboardData();
    window.addEventListener('api_cortex_refresh', handleCustomRefresh);

    const interval = setInterval(loadDashboardData, 15000);
    return () => {
      window.removeEventListener('api_cortex_refresh', handleCustomRefresh);
      clearInterval(interval);
    };
  }, [loadDashboardData]);

  const handleTriggerCheck = async (apiId) => {
    setCheckingApiId(apiId);
    try {
      await apiConfigsAPI.triggerCheck(apiId);
      await loadDashboardData();
    } catch (err) {
      alert(err.response?.data?.detail || "Manual check execution failed.");
    } finally {
      setCheckingApiId(null);
    }
  };

  const handleDiagnose = async (issue) => {
    setDiagnosingIssueId(issue.id);
    try {
      const res = await issuesAPI.diagnose(issue.id);
      openDiagnosisModal(res, issue);
      await loadDashboardData();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to trigger Gemini diagnosis.");
    } finally {
      setDiagnosingIssueId(null);
    }
  };

  return (
    <div>
      {/* Header Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '700', letterSpacing: '-0.02em' }}>
              {currentProject ? currentProject.name : 'System Overview Dashboard'}
            </h1>
            <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
              {currentProject ? 'Project Workspace' : 'All Workspaces'}
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            {currentProject?.description || 'Real-time API contract validation, SLA availability, and Gemini AI failure diagnosis.'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={loadDashboardData}
            title="Refresh Metrics"
          >
            <RefreshCw size={14} className={loading ? 'spin-loader' : ''} /> Refresh
          </button>
          <button 
            className="btn btn-primary btn-sm"
            onClick={() => openApiModal()}
          >
            <Plus size={14} /> Monitored API
          </button>
        </div>
      </div>

      {/* Main KPI Stat Cards */}
      <HealthStatusCards summary={summary} />

      {/* Latency Trends & Issues Charts */}
      <MetricsCharts monitoringLogs={monitoringLogs} issues={issues} />

      {/* Quick Access Grid: Active Monitored APIs & Recent Issues */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        
        {/* Monitored APIs Widget */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Server size={18} style={{ color: 'var(--accent-cyan)' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: '600' }}>Monitored APIs ({apiConfigs.length})</h3>
            </div>
            <Link to="/apis" style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', textDecoration: 'none' }}>
              View All APIs →
            </Link>
          </div>

          {apiConfigs.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No target APIs registered under this workspace.
            </div>
          ) : (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>API</th>
                    <th>Interval</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {apiConfigs.slice(0, 5).map(cfg => (
                    <tr key={cfg.id}>
                      <td>
                        <Link to={`/apis/${cfg.id}`} style={{ fontWeight: '600', color: 'var(--text-primary)', textDecoration: 'none' }}>
                          {cfg.name}
                        </Link>
                        <div className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {cfg.method} {cfg.url}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {cfg.polling_interval_seconds}s
                      </td>
                      <td>
                        <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>
                          Active
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button 
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleTriggerCheck(cfg.id)}
                          disabled={checkingApiId === cfg.id}
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                        >
                          <RefreshCw size={12} className={checkingApiId === cfg.id ? 'spin-loader' : ''} />
                          {checkingApiId === cfg.id ? 'Checking...' : 'Check'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Issues & Drift Widget */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertOctagon size={18} style={{ color: 'var(--status-danger)' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: '600' }}>Recent Contract Issues ({issues.length})</h3>
            </div>
            <Link to="/issues" style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', textDecoration: 'none' }}>
              View All Issues →
            </Link>
          </div>

          {issues.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--status-success)', fontSize: '0.9rem' }}>
              <CheckCircle2 size={32} style={{ margin: '0 auto 0.5rem auto' }} />
              All API contracts and endpoints are healthy!
            </div>
          ) : (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Type & API</th>
                    <th>Error Summary</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.slice(0, 5).map(iss => (
                    <tr key={iss.id}>
                      <td>
                        <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>
                          {iss.issue_type}
                        </span>
                        <div style={{ fontWeight: '600', fontSize: '0.82rem', marginTop: '2px' }}>
                          {iss.api_name || `API #${iss.api_config_id}`}
                        </div>
                      </td>
                      <td style={{ maxWidth: '200px' }}>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {iss.error_details}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={() => openDriftViewer(iss)}
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem' }}
                            title="Inspect Schema Drift"
                          >
                            <Eye size={12} /> Drift
                          </button>
                          <button 
                            className="btn btn-primary btn-sm"
                            onClick={() => handleDiagnose(iss)}
                            disabled={diagnosingIssueId === iss.id}
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem' }}
                            title="Run Gemini AI Diagnosis"
                          >
                            <Sparkles size={12} /> AI Fix
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}

export default DashboardPage;
