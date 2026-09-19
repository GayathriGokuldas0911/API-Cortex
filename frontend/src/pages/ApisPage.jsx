import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  Server, Plus, RefreshCw, Eye, Edit3, Trash2, ExternalLink, Clock, CheckCircle2, AlertOctagon, Search, Filter 
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiConfigsAPI, monitoringAPI, issuesAPI } from '../api/client';

function ApisPage() {
  const { currentProject, openApiModal } = useApp();

  const [apis, setApis] = useState([]);
  const [apiMetrics, setApiMetrics] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [checkingApiId, setCheckingApiId] = useState(null);

  const loadApis = useCallback(async () => {
    setLoading(true);
    const projId = currentProject?.id || null;
    try {
      const data = await apiConfigsAPI.getAll(projId);
      setApis(data || []);

      // Fetch latest log and issue count for each API
      const metrics = {};
      for (const api of data || []) {
        try {
          const [logs, issues] = await Promise.all([
            monitoringAPI.getLogs({ api_config_id: api.id, limit: 5 }).catch(() => []),
            issuesAPI.getAll({ api_config_id: api.id }).catch(() => [])
          ]);
          const latestLog = logs?.[0];
          const totalChecks = logs?.length || 0;
          const successfulChecks = logs?.filter(l => l.is_healthy).length || 0;
          const availability = totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 100;

          metrics[api.id] = {
            lastChecked: latestLog?.timestamp ? new Date(latestLog.timestamp).toLocaleTimeString() : 'Never',
            latencyMs: latestLog?.response_time_ms ? Math.round(latestLog.response_time_ms) : 0,
            isHealthy: latestLog ? latestLog.is_healthy : true,
            issuesCount: issues?.length || 0,
            availability: availability.toFixed(1)
          };
        } catch (e) {
          metrics[api.id] = { lastChecked: 'N/A', latencyMs: 0, isHealthy: true, issuesCount: 0, availability: '100' };
        }
      }
      setApiMetrics(metrics);
    } catch (err) {
      console.error("Failed to load APIs:", err);
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

  useEffect(() => {
    loadApis();
    const handleRefresh = () => loadApis();
    window.addEventListener('api_cortex_refresh', handleRefresh);
    return () => window.removeEventListener('api_cortex_refresh', handleRefresh);
  }, [loadApis]);

  const handleTriggerCheck = async (apiId) => {
    setCheckingApiId(apiId);
    try {
      await apiConfigsAPI.triggerCheck(apiId);
      await loadApis();
    } catch (err) {
      alert(err.response?.data?.detail || "Manual check execution failed.");
    } finally {
      setCheckingApiId(null);
    }
  };

  const handleDeleteApi = async (apiId) => {
    if (window.confirm("Are you sure you want to delete this monitored target API?")) {
      try {
        await apiConfigsAPI.delete(apiId);
        await loadApis();
      } catch (err) {
        alert(err.response?.data?.detail || "Failed to delete API.");
      }
    }
  };

  const filteredApis = apis.filter(api => {
    const matchesSearch = api.name.toLowerCase().includes(search.toLowerCase()) || 
                          api.url.toLowerCase().includes(search.toLowerCase());
    const matchesMethod = methodFilter === 'ALL' || api.method === methodFilter;
    return matchesSearch && matchesMethod;
  });

  const getMethodBadgeClass = (m) => {
    switch (m) {
      case 'GET': return 'badge-info';
      case 'POST': return 'badge-success';
      case 'PUT': return 'badge-warning';
      case 'DELETE': return 'badge-danger';
      default: return 'badge-purple';
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Server size={26} style={{ color: 'var(--accent-cyan)' }} />
            <h1 style={{ fontSize: '1.75rem', fontWeight: '700' }}>Monitored Target APIs</h1>
            <span className="badge badge-purple" style={{ fontSize: '0.75rem' }}>{filteredApis.length} Active</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            {currentProject ? `Scoped to workspace: ${currentProject.name}` : 'Showing APIs across all workspaces.'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button className="btn btn-secondary btn-sm" onClick={loadApis}>
            <RefreshCw size={14} className={loading ? 'spin-loader' : ''} /> Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => openApiModal()}>
            <Plus size={15} /> Monitored API
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '240px' }}>
          <Search size={16} style={{ color: 'var(--text-muted)' }} />
          <input 
            type="text"
            className="form-input"
            placeholder="Search APIs by name or endpoint URL..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '0.45rem 0.8rem', fontSize: '0.85rem' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Method:</span>
          <select 
            className="form-select" 
            value={methodFilter} 
            onChange={(e) => setMethodFilter(e.target.value)}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
          >
            <option value="ALL">All Methods</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        {filteredApis.length === 0 ? (
          <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
            <Server size={32} style={{ color: 'var(--accent-cyan)', margin: '0 auto 0.75rem auto' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.4rem' }}>No Target APIs Found</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              {search || methodFilter !== 'ALL' ? 'No APIs match the filter criteria.' : 'Register your first target API to start real-time health monitoring.'}
            </p>
            <button className="btn btn-primary btn-sm" onClick={() => openApiModal()}>
              <Plus size={14} /> Register Target API
            </button>
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Target API & URL</th>
                  <th>Status</th>
                  <th>Latency</th>
                  <th>Last Checked</th>
                  <th>Issues</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredApis.map(api => {
                  const m = apiMetrics[api.id] || { lastChecked: '...', latencyMs: 0, isHealthy: true, issuesCount: 0, availability: '100' };

                  return (
                    <tr key={api.id}>
                      <td style={{ width: '80px' }}>
                        <span className={`badge ${getMethodBadgeClass(api.method)}`}>
                          {api.method}
                        </span>
                      </td>

                      <td>
                        <Link to={`/apis/${api.id}`} style={{ fontWeight: '600', color: 'var(--text-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span>{api.name}</span>
                        </Link>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          <span className="font-mono">{api.url}</span>
                          <a href={api.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)' }}>
                            <ExternalLink size={11} />
                          </a>
                        </div>
                      </td>

                      <td>
                        <span className={`badge ${m.isHealthy ? 'badge-success' : 'badge-danger'}`} style={{ gap: '4px', fontSize: '0.7rem' }}>
                          {m.isHealthy ? <CheckCircle2 size={12} /> : <AlertOctagon size={12} />}
                          {m.isHealthy ? 'HEALTHY' : 'DEGRADED'}
                        </span>
                      </td>

                      <td className="font-mono" style={{ fontSize: '0.85rem' }}>
                        {m.latencyMs} ms
                      </td>

                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} />
                          <span>{m.lastChecked}</span>
                        </div>
                      </td>

                      <td>
                        <span className={`badge ${m.issuesCount > 0 ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.7rem' }}>
                          {m.issuesCount} Open
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          
                          {/* VIEW */}
                          <Link 
                            to={`/apis/${api.id}`} 
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                            title="View API Details"
                          >
                            <Eye size={13} /> View
                          </Link>

                          {/* CHECK NOW */}
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleTriggerCheck(api.id)}
                            disabled={checkingApiId === api.id}
                            style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                            title="Trigger Manual Health Poll"
                          >
                            <RefreshCw size={12} className={checkingApiId === api.id ? 'spin-loader' : ''} />
                            {checkingApiId === api.id ? 'Checking...' : 'Check'}
                          </button>

                          {/* EDIT */}
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={() => openApiModal(api)}
                            style={{ padding: '0.35rem 0.5rem' }}
                            title="Edit API"
                          >
                            <Edit3 size={13} />
                          </button>

                          {/* DELETE */}
                          <button 
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteApi(api.id)}
                            style={{ padding: '0.35rem 0.5rem' }}
                            title="Delete API"
                          >
                            <Trash2 size={13} />
                          </button>

                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}

export default ApisPage;
