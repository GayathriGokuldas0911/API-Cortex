import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import HealthStatusCards from '../components/HealthStatusCards';
import ApiList from '../components/ApiList';
import ApiConfigModal from '../components/ApiConfigModal';
import SchemaDriftViewer from '../components/SchemaDriftViewer';
import AiDiagnosisModal from '../components/AiDiagnosisModal';
import MetricsCharts from '../components/MetricsCharts';
import AuthModal from '../components/AuthModal';

import { 
  dashboardAPI, apiConfigsAPI, issuesAPI, monitoringAPI, authAPI, getAuthToken 
} from '../api/client';

import { 
  Server, AlertOctagon, Cpu, RefreshCw, Layers, CheckCircle2, XCircle, AlertTriangle, ArrowRight, Eye, Sparkles 
} from 'lucide-react';

function Dashboard() {
  // Application Data States
  const [user, setUser] = useState(null);
  const [systemHealth, setSystemHealth] = useState(null);
  const [summary, setSummary] = useState(null);
  const [apiConfigs, setApiConfigs] = useState([]);
  const [issues, setIssues] = useState([]);
  const [monitoringLogs, setMonitoringLogs] = useState([]);
  
  // UI States
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'apis', 'issues', 'logs'
  const [checkingApiId, setCheckingApiId] = useState(null);
  const [diagnosingIssueId, setDiagnosingIssueId] = useState(null);

  // Modal States
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [editingApiConfig, setEditingApiConfig] = useState(null);

  const [isDriftViewerOpen, setIsDriftViewerOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState(null);

  const [isDiagnosisModalOpen, setIsDiagnosisModalOpen] = useState(false);
  const [currentDiagnosis, setCurrentDiagnosis] = useState(null);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Initial Data Load
  useEffect(() => {
    fetchInitialData();

    // Auto-refresh interval every 15 seconds
    const interval = setInterval(() => {
      fetchDashboardDataSilently();
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    await fetchUserData();
    await fetchDashboardDataSilently();
    setLoading(false);
  };

  const fetchUserData = async () => {
    const token = getAuthToken();
    if (token) {
      try {
        const me = await authAPI.getMe();
        setUser(me);
      } catch (err) {
        console.warn("Auth token invalid, logging out");
        authAPI.logout();
        setUser(null);
      }
    }
  };

  const fetchDashboardDataSilently = async () => {
    try {
      const [health, sum, configs, iss, logs] = await Promise.all([
        dashboardAPI.getHealth().catch(() => null),
        dashboardAPI.getSummary().catch(() => null),
        apiConfigsAPI.getAll().catch(() => []),
        issuesAPI.getAll().catch(() => []),
        monitoringAPI.getLogs().catch(() => [])
      ]);

      if (health) setSystemHealth(health);
      if (sum) setSummary(sum);
      if (configs) setApiConfigs(configs);
      if (iss) setIssues(iss);
      if (logs) setMonitoringLogs(logs);
    } catch (err) {
      console.error("Error updating dashboard data:", err);
    }
  };

  // Handlers for Target API CRUD
  const handleSaveApiConfig = async (payload, configId) => {
    if (configId) {
      await apiConfigsAPI.update(configId, payload);
    } else {
      await apiConfigsAPI.create(payload);
    }
    await fetchDashboardDataSilently();
  };

  const handleDeleteApiConfig = async (configId) => {
    if (window.confirm("Are you sure you want to delete this monitored target API?")) {
      try {
        await apiConfigsAPI.delete(configId);
        await fetchDashboardDataSilently();
      } catch (err) {
        alert(err.response?.data?.detail || "Failed to delete API configuration");
      }
    }
  };

  const handleTriggerCheck = async (configId) => {
    setCheckingApiId(configId);
    try {
      await apiConfigsAPI.triggerCheck(configId);
      await fetchDashboardDataSilently();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to execute manual poll check");
    } finally {
      setCheckingApiId(null);
    }
  };

  // Handlers for Schema Drift & Gemini Diagnosis
  const handleOpenDriftViewer = (issue) => {
    setSelectedIssue(issue);
    setIsDriftViewerOpen(true);
  };

  const handleDiagnoseIssue = async (issueId) => {
    setDiagnosingIssueId(issueId);
    try {
      const result = await issuesAPI.diagnose(issueId);
      setCurrentDiagnosis(result.diagnosis);
      setIsDriftViewerOpen(false);
      setIsDiagnosisModalOpen(true);
      await fetchDashboardDataSilently();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to generate Gemini AI diagnosis");
    } finally {
      setDiagnosingIssueId(null);
    }
  };

  const handleViewExistingDiagnosis = async (issue) => {
    setSelectedIssue(issue);
    try {
      const diagnosis = await issuesAPI.getDiagnosis(issue.id);
      setCurrentDiagnosis(diagnosis);
      setIsDiagnosisModalOpen(true);
    } catch (err) {
      // If diagnosis not yet run, trigger new diagnosis
      handleDiagnoseIssue(issue.id);
    }
  };

  const handleLogout = () => {
    authAPI.logout();
    setUser(null);
    fetchDashboardDataSilently();
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.5rem' }}>
      
      {/* Top Navbar */}
      <Navbar 
        user={user}
        systemHealth={systemHealth}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
        onOpenNewApi={() => {
          setEditingApiConfig(null);
          setIsApiModalOpen(true);
        }}
      />

      {/* Main Health Status Cards */}
      <HealthStatusCards summary={summary} />

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '8px', background: 'rgba(15, 23, 42, 0.6)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          
          <button 
            className="btn btn-sm"
            style={{ background: activeTab === 'overview' ? 'rgba(0, 242, 254, 0.15)' : 'transparent', color: activeTab === 'overview' ? 'var(--accent-cyan)' : 'var(--text-secondary)' }}
            onClick={() => setActiveTab('overview')}
          >
            Overview Dashboard
          </button>

          <button 
            className="btn btn-sm"
            style={{ background: activeTab === 'apis' ? 'rgba(0, 242, 254, 0.15)' : 'transparent', color: activeTab === 'apis' ? 'var(--accent-cyan)' : 'var(--text-secondary)' }}
            onClick={() => setActiveTab('apis')}
          >
            Target APIs ({apiConfigs.length})
          </button>

          <button 
            className="btn btn-sm"
            style={{ background: activeTab === 'issues' ? 'rgba(239, 68, 68, 0.15)' : 'transparent', color: activeTab === 'issues' ? 'var(--status-danger)' : 'var(--text-secondary)' }}
            onClick={() => setActiveTab('issues')}
          >
            Issues & Drift ({issues.length})
          </button>

          <button 
            className="btn btn-sm"
            style={{ background: activeTab === 'logs' ? 'rgba(139, 92, 246, 0.15)' : 'transparent', color: activeTab === 'logs' ? 'var(--accent-purple)' : 'var(--text-secondary)' }}
            onClick={() => setActiveTab('logs')}
          >
            Monitoring Logs ({monitoringLogs.length})
          </button>

        </div>

        <button className="btn btn-secondary btn-sm" onClick={fetchDashboardDataSilently}>
          <RefreshCw size={14} className={loading ? 'spin-loader' : ''} /> Refresh Data
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {(activeTab === 'overview' || activeTab === 'apis') && (
        <ApiList 
          apiConfigs={apiConfigs}
          onEdit={(config) => {
            setEditingApiConfig(config);
            setIsApiModalOpen(true);
          }}
          onDelete={handleDeleteApiConfig}
          onTriggerCheck={handleTriggerCheck}
          checkingApiId={checkingApiId}
        />
      )}

      {/* Visual Recharts Latency Trends */}
      {activeTab === 'overview' && (
        <MetricsCharts monitoringLogs={monitoringLogs} issues={issues} />
      )}

      {/* TAB 2: ISSUES & SCHEMA DRIFT */}
      {(activeTab === 'overview' || activeTab === 'issues') && (
        <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertOctagon size={20} style={{ color: 'var(--status-danger)' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: '600' }}>
                Detected Contract Drift & Health Issues
              </h3>
              <span className="badge badge-danger">{issues.length} Issues Logged</span>
            </div>
          </div>

          {issues.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--status-success)', fontSize: '0.9rem' }}>
              <CheckCircle2 size={32} style={{ margin: '0 auto 0.75rem auto', display: 'block' }} />
              All monitored API contracts are healthy and strictly matching expected JSON Schemas!
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
                    <th>Detected At</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.map(iss => (
                    <tr key={iss.id}>
                      <td>
                        <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>#{iss.id}</div>
                        <span className="badge badge-danger" style={{ fontSize: '0.65rem', marginTop: '2px' }}>
                          {iss.issue_type}
                        </span>
                      </td>

                      <td>
                        <div style={{ fontWeight: '600' }}>{iss.api_config?.name || `API ID ${iss.api_config_id}`}</div>
                        <div className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {iss.api_config?.url}
                        </div>
                      </td>

                      <td style={{ maxWidth: '300px' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {iss.error_details}
                        </div>
                      </td>

                      <td>
                        <span className={`badge ${iss.status === 'DIAGNOSED' ? 'badge-purple' : 'badge-warning'}`}>
                          {iss.status}
                        </span>
                      </td>

                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(iss.created_at).toLocaleString()}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          
                          {/* Drift Inspector */}
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenDriftViewer(iss)}
                            title="Inspect Schema Drift"
                            style={{ padding: '0.35rem 0.6rem' }}
                          >
                            <Eye size={14} /> Drift Diff
                          </button>

                          {/* Gemini AI Diagnosis */}
                          <button 
                            className="btn btn-primary btn-sm"
                            onClick={() => handleViewExistingDiagnosis(iss)}
                            disabled={diagnosingIssueId === iss.id}
                            style={{ padding: '0.35rem 0.65rem' }}
                          >
                            <Sparkles size={14} />
                            {diagnosingIssueId === iss.id ? 'Diagnosing...' : 'AI Fix'}
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
      )}

      {/* TAB 3: MONITORING HISTORY LOGS */}
      {activeTab === 'logs' && (
        <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={20} style={{ color: 'var(--accent-purple)' }} />
            Relational Monitoring History Logs
          </h3>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Log ID</th>
                  <th>API ID</th>
                  <th>HTTP Status</th>
                  <th>Latency (ms)</th>
                  <th>Health Status</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {monitoringLogs.map(log => (
                  <tr key={log.id}>
                    <td>#{log.id}</td>
                    <td>API #{log.api_config_id}</td>
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
      )}

      {/* Modals */}
      <ApiConfigModal 
        isOpen={isApiModalOpen}
        onClose={() => setIsApiModalOpen(false)}
        onSave={handleSaveApiConfig}
        editingConfig={editingApiConfig}
      />

      <SchemaDriftViewer 
        isOpen={isDriftViewerOpen}
        onClose={() => setIsDriftViewerOpen(false)}
        issue={selectedIssue}
        onDiagnose={handleDiagnoseIssue}
        isDiagnosing={diagnosingIssueId === selectedIssue?.id}
      />

      <AiDiagnosisModal 
        isOpen={isDiagnosisModalOpen}
        onClose={() => setIsDiagnosisModalOpen(false)}
        diagnosis={currentDiagnosis}
        issue={selectedIssue}
      />

      <AuthModal 
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={fetchInitialData}
      />

    </div>
  );
}

export default Dashboard;
