import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Server, ArrowLeft, RefreshCw, CheckCircle2, AlertOctagon, Clock, 
  ExternalLink, FileCode, BarChart3, Settings, Edit3, Trash2, Eye, Sparkles, Cpu 
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiConfigsAPI, monitoringAPI, issuesAPI } from '../api/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function ApiDetailsPage() {
  const { apiId } = useParams();
  const navigate = useNavigate();
  const { openApiModal, openDriftViewer, openDiagnosisModal } = useApp();

  const [api, setApi] = useState(null);
  const [logs, setLogs] = useState([]);
  const [issues, setIssues] = useState([]);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'monitoring', 'issues', 'schema', 'settings'
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const loadApiData = useCallback(async () => {
    if (!apiId) return;
    setLoading(true);
    try {
      const [apiData, logData, issueData] = await Promise.all([
        apiConfigsAPI.getById(apiId),
        monitoringAPI.getLogs({ api_config_id: apiId, limit: 50 }).catch(() => []),
        issuesAPI.getAll({ api_config_id: apiId }).catch(() => [])
      ]);
      setApi(apiData);
      setLogs(logData || []);
      setIssues(issueData || []);
    } catch (err) {
      console.error("Failed to load API details:", err);
      if (err.response?.status === 404 || err.response?.status === 403) {
        alert("Target API not found or access forbidden.");
        navigate('/apis');
      }
    } finally {
      setLoading(false);
    }
  }, [apiId, navigate]);

  useEffect(() => {
    loadApiData();
    const handleRefresh = () => loadApiData();
    window.addEventListener('api_cortex_refresh', handleRefresh);
    return () => window.removeEventListener('api_cortex_refresh', handleRefresh);
  }, [loadApiData]);

  const handleTriggerCheck = async () => {
    setChecking(true);
    try {
      await apiConfigsAPI.triggerCheck(apiId);
      await loadApiData();
    } catch (err) {
      alert(err.response?.data?.detail || "Manual check failed.");
    } finally {
      setChecking(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete '${api?.name}'?`)) {
      try {
        await apiConfigsAPI.delete(apiId);
        navigate('/apis');
      } catch (err) {
        alert(err.response?.data?.detail || "Failed to delete API.");
      }
    }
  };

  if (loading && !api) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading API details...</div>;
  }

  // Calculate Overview Stats
  const totalChecks = logs.length;
  const successfulChecks = logs.filter(l => l.is_healthy).length;
  const availability = totalChecks > 0 ? ((successfulChecks / totalChecks) * 100).toFixed(1) : '100.0';
  const avgLatency = totalChecks > 0 ? Math.round(logs.reduce((acc, l) => acc + (l.response_time_ms || 0), 0) / totalChecks) : 0;
  const errorRate = totalChecks > 0 ? (((totalChecks - successfulChecks) / totalChecks) * 100).toFixed(1) : '0.0';
  const latestLog = logs[0];
  const isHealthy = latestLog ? latestLog.is_healthy : true;

  const chartData = logs.slice(0, 20).reverse().map(l => ({
    time: new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    latency: Math.round(l.response_time_ms || 0),
    healthy: l.is_healthy
  }));

  return (
    <div>
      {/* Top Breadcrumb & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <Link to="/apis" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
          <ArrowLeft size={15} /> Back to APIs
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleTriggerCheck} disabled={checking}>
            <RefreshCw size={13} className={checking ? 'spin-loader' : ''} />
            {checking ? 'Executing Check...' : 'Check Now'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => openApiModal(api)}>
            <Edit3 size={13} /> Edit Config
          </button>
        </div>
      </div>

      {/* API Header Card */}
      <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.4rem' }}>
              <span className={`badge ${api?.method === 'GET' ? 'badge-info' : 'badge-success'}`}>
                {api?.method}
              </span>
              <h1 style={{ fontSize: '1.5rem', fontWeight: '700' }}>{api?.name}</h1>
              <span className={`badge ${isHealthy ? 'badge-success' : 'badge-danger'}`} style={{ gap: '4px' }}>
                {isHealthy ? <CheckCircle2 size={12} /> : <AlertOctagon size={12} />}
                {isHealthy ? 'HEALTHY' : 'FAILING'}
              </span>
              <span className="badge badge-purple">{api?.environment || 'production'}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <span className="font-mono">{api?.url}</span>
              <a href={api?.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)' }}>
                <ExternalLink size={13} />
              </a>
              <span>• Polling: {api?.polling_interval_seconds}s</span>
              <span>• Expected HTTP {api?.expected_status_code}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', background: 'rgba(15, 23, 42, 0.6)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '1.5rem', width: 'fit-content' }}>
        {[
          { id: 'overview', label: 'Overview', icon: Server },
          { id: 'monitoring', label: `Monitoring (${logs.length})`, icon: BarChart3 },
          { id: 'issues', label: `Issues (${issues.length})`, icon: AlertOctagon },
          { id: 'schema', label: 'Schema Contract', icon: FileCode },
          { id: 'settings', label: 'Settings', icon: Settings },
        ].map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              <Icon size={15} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>AVAILABILITY SLA</span>
              <h2 style={{ fontSize: '1.75rem', fontWeight: '700', color: parseFloat(availability) >= 95 ? 'var(--status-success)' : 'var(--status-warning)' }}>
                {availability}%
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Based on last {totalChecks} checks</span>
            </div>

            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>AVG RESPONSE LATENCY</span>
              <h2 style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--accent-cyan)' }}>
                {avgLatency} <span style={{ fontSize: '1rem', fontWeight: '500' }}>ms</span>
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>HTTPX async client</span>
            </div>

            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>FAILURE ERROR RATE</span>
              <h2 style={{ fontSize: '1.75rem', fontWeight: '700', color: parseFloat(errorRate) > 0 ? 'var(--status-danger)' : 'var(--status-success)' }}>
                {errorRate}%
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{totalChecks - successfulChecks} failures logged</span>
            </div>

            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>LAST POLLED</span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginTop: '0.25rem' }}>
                {latestLog?.timestamp ? new Date(latestLog.timestamp).toLocaleTimeString() : 'Never'}
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Status: HTTP {latestLog?.status_code || 'N/A'}</span>
            </div>
          </div>

          {/* Latency Graph */}
          <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem' }}>Response Latency Timeline (ms)</h3>
            {chartData.length > 0 ? (
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={11} />
                    <YAxis stroke="var(--text-muted)" fontSize={11} unit="ms" />
                    <Tooltip contentStyle={{ background: '#0d121f', borderColor: 'var(--border-color)', borderRadius: '8px' }} />
                    <Line type="monotone" dataKey="latency" stroke="var(--accent-cyan)" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                No monitoring checks recorded yet. Click "Check Now" to test.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: MONITORING LOGS */}
      {activeTab === 'monitoring' && (
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: '600', marginBottom: '1rem' }}>Historical Monitoring Checks</h3>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Check ID</th>
                  <th>HTTP Status</th>
                  <th>Response Time</th>
                  <th>Outcome</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
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
      )}

      {/* TAB 3: ISSUES */}
      {activeTab === 'issues' && (
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: '600', marginBottom: '1rem' }}>Detected Schema Drift & Failures</h3>
          {issues.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--status-success)', fontSize: '0.9rem' }}>
              <CheckCircle2 size={32} style={{ margin: '0 auto 0.5rem auto' }} />
              No issues detected for this API. Contract is perfectly healthy!
            </div>
          ) : (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Issue ID & Type</th>
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
                        <div style={{ fontWeight: '600', fontSize: '0.82rem', marginTop: '2px' }}>#{iss.id}</div>
                      </td>
                      <td style={{ maxWidth: '300px' }}>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{iss.error_details}</div>
                      </td>
                      <td>
                        <span className={`badge ${iss.status === 'DIAGNOSED' ? 'badge-purple' : 'badge-warning'}`}>
                          {iss.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {new Date(iss.created_at).toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => openDriftViewer(iss)} style={{ padding: '0.3rem 0.55rem' }}>
                            <Eye size={12} /> Drift
                          </button>
                          <button 
                            className="btn btn-primary btn-sm" 
                            onClick={async () => {
                              const res = await issuesAPI.diagnose(iss.id);
                              openDiagnosisModal(res, iss);
                            }}
                            style={{ padding: '0.3rem 0.55rem' }}
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
      )}

      {/* TAB 4: SCHEMA */}
      {activeTab === 'schema' && (
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: '600', marginBottom: '1rem' }}>Expected JSON Contract Schema</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Structural contract verified against every response body payload. Any missing fields, extra fields, or type mismatches trigger automatic drift alerts.
          </p>
          <pre style={{
            background: '#040812',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '1rem',
            fontSize: '0.82rem',
            color: '#a5f3fc',
            maxHeight: '350px',
            overflowY: 'auto'
          }}>
            {JSON.stringify(api?.expected_schema || {}, null, 2)}
          </pre>
        </div>
      )}

      {/* TAB 5: SETTINGS */}
      {activeTab === 'settings' && (
        <div className="glass-card" style={{ padding: '1.75rem', maxWidth: '600px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1.25rem' }}>
            Target API Danger Zone
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Permanently delete this monitored target API and remove all associated monitoring execution logs and issues.
          </p>
          <button className="btn btn-danger btn-sm" onClick={handleDelete}>
            <Trash2 size={14} /> Delete Monitored API
          </button>
        </div>
      )}

    </div>
  );
}

export default ApiDetailsPage;
