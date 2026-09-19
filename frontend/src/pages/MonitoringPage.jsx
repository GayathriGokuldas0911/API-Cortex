import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart3, RefreshCw, ExternalLink, Activity, CheckCircle2, AlertOctagon, Clock, ShieldCheck 
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { dashboardAPI, monitoringAPI, issuesAPI } from '../api/client';
import MetricsCharts from '../components/MetricsCharts';

function MonitoringPage() {
  const { currentProject } = useApp();

  const [summary, setSummary] = useState(null);
  const [logs, setLogs] = useState([]);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadMonitoringData = useCallback(async () => {
    setLoading(true);
    const projId = currentProject?.id || null;
    try {
      const [sum, logData, issueData] = await Promise.all([
        dashboardAPI.getSummary(projId).catch(() => null),
        monitoringAPI.getLogs(projId ? { project_id: projId, limit: 100 } : { limit: 100 }).catch(() => []),
        issuesAPI.getAll(projId ? { project_id: projId } : {}).catch(() => [])
      ]);

      if (sum) setSummary(sum);
      if (logData) setLogs(logData);
      if (issueData) setIssues(issueData);
    } catch (err) {
      console.error("Monitoring fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

  useEffect(() => {
    loadMonitoringData();
    const interval = setInterval(loadMonitoringData, 15000);
    return () => clearInterval(interval);
  }, [loadMonitoringData]);

  const totalRequests = summary?.total_requests ?? logs.length;
  const totalErrors = summary?.total_errors ?? logs.filter(l => !l.is_healthy).length;
  const totalSuccess = totalRequests - totalErrors;
  const availability = summary?.availability_percentage ?? (totalRequests > 0 ? ((totalSuccess / totalRequests) * 100).toFixed(1) : 100.0);
  const avgLatency = summary?.avg_response_time_ms ?? 0;
  const errorRate = totalRequests > 0 ? ((totalErrors / totalRequests) * 100).toFixed(1) : 0.0;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BarChart3 size={26} style={{ color: 'var(--accent-purple)' }} />
            <h1 style={{ fontSize: '1.75rem', fontWeight: '700' }}>Application Monitoring & Telemetry</h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Time-series latency percentiles, error rate tracking, and Prometheus metrics telemetry.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <a 
            href="http://localhost:3000" 
            target="_blank" 
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
            title="Open Grafana Dashboards"
            style={{ gap: '6px' }}
          >
            <ExternalLink size={14} style={{ color: 'var(--accent-purple)' }} />
            Open Grafana Dashboard
          </a>

          <button className="btn btn-secondary btn-sm" onClick={loadMonitoringData}>
            <RefreshCw size={14} className={loading ? 'spin-loader' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
        
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TOTAL REQUESTS</span>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '700', marginTop: '0.2rem' }}>{totalRequests}</h2>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Automated HTTP polls</span>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SUCCESS CHECKS</span>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--status-success)', marginTop: '0.2rem' }}>{totalSuccess}</h2>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Healthy contract matches</span>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>FAILURE CHECKS</span>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '700', color: totalErrors > 0 ? 'var(--status-danger)' : 'var(--status-success)', marginTop: '0.2rem' }}>
            {totalErrors}
          </h2>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>HTTP/Drift errors</span>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>AVAILABILITY RATE</span>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--accent-cyan)', marginTop: '0.2rem' }}>
            {Number(availability).toFixed(1)}%
          </h2>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>SLA uptime calculation</span>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>AVG LATENCY</span>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--accent-purple)', marginTop: '0.2rem' }}>
            {Math.round(avgLatency)} <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>ms</span>
          </h2>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Response time</span>
        </div>

      </div>

      {/* Recharts Latency and Contract Breakdown */}
      <MetricsCharts monitoringLogs={logs} issues={issues} />

      {/* Historical Monitoring Checks Table */}
      <div className="glass-card" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: '600' }}>Recent Telemetry Execution Logs</h3>
          <span className="badge badge-purple" style={{ fontSize: '0.7rem' }}>Last 50 Records</span>
        </div>

        {logs.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No monitoring check logs recorded yet.
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Check ID</th>
                  <th>Target API ID</th>
                  <th>Status Code</th>
                  <th>Response Time</th>
                  <th>Result</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 30).map(l => (
                  <tr key={l.id}>
                    <td>#{l.id}</td>
                    <td>API #{l.api_config_id}</td>
                    <td>
                      <span className={`badge ${l.status_code >= 200 && l.status_code < 300 ? 'badge-success' : 'badge-danger'}`}>
                        HTTP {l.status_code || 'N/A'}
                      </span>
                    </td>
                    <td className="font-mono">{Math.round(l.response_time_ms)} ms</td>
                    <td>
                      <span className={`badge ${l.is_healthy ? 'badge-success' : 'badge-danger'}`}>
                        {l.is_healthy ? 'HEALTHY' : 'FAILED'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {new Date(l.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}

export default MonitoringPage;
