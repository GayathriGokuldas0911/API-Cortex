import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  AlertOctagon, Filter, Search, RefreshCw, Eye, Sparkles, CheckCircle2, AlertTriangle, XCircle, ArrowRight 
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { issuesAPI } from '../api/client';

function IssuesPage() {
  const { currentProject, openDriftViewer, openDiagnosisModal } = useApp();
  const navigate = useNavigate();

  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [diagnosingIssueId, setDiagnosingIssueId] = useState(null);

  const loadIssues = useCallback(async () => {
    setLoading(true);
    const params = {};
    if (currentProject?.id) params.project_id = currentProject.id;
    if (statusFilter !== 'ALL') params.status = statusFilter;

    try {
      const data = await issuesAPI.getAll(params);
      setIssues(data || []);
    } catch (err) {
      console.error("Failed to load issues:", err);
    } finally {
      setLoading(false);
    }
  }, [currentProject, statusFilter]);

  useEffect(() => {
    loadIssues();
    const handleRefresh = () => loadIssues();
    window.addEventListener('api_cortex_refresh', handleRefresh);
    return () => window.removeEventListener('api_cortex_refresh', handleRefresh);
  }, [loadIssues]);

  const handleDiagnose = async (issue) => {
    setDiagnosingIssueId(issue.id);
    try {
      const res = await issuesAPI.diagnose(issue.id);
      openDiagnosisModal(res, issue);
      await loadIssues();
    } catch (err) {
      alert(err.response?.data?.detail || "Gemini diagnosis execution failed.");
    } finally {
      setDiagnosingIssueId(null);
    }
  };

  const filteredIssues = issues.filter(iss => {
    const matchesSearch = (iss.error_details || '').toLowerCase().includes(search.toLowerCase()) ||
                          (iss.api_name || '').toLowerCase().includes(search.toLowerCase()) ||
                          (iss.project_name || '').toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'ALL' || iss.issue_type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertOctagon size={26} style={{ color: 'var(--status-danger)' }} />
            <h1 style={{ fontSize: '1.75rem', fontWeight: '700' }}>Detected Issues & Schema Drift</h1>
            <span className="badge badge-danger" style={{ fontSize: '0.75rem' }}>{filteredIssues.length} Logged</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            {currentProject ? `Filtered by workspace: ${currentProject.name}` : 'Contract drift, missing fields, and HTTP anomalies across all monitored endpoints.'}
          </p>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={loadIssues}>
          <RefreshCw size={14} className={loading ? 'spin-loader' : ''} /> Refresh
        </button>
      </div>

      {/* Filter Controls */}
      <div className="glass-card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '220px' }}>
          <Search size={16} style={{ color: 'var(--text-muted)' }} />
          <input 
            type="text"
            className="form-input"
            placeholder="Search by API name, project, or error..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '0.45rem 0.8rem', fontSize: '0.85rem' }}
          />
        </div>

        {/* Issue Type Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Type:</span>
          <select 
            className="form-select" 
            value={typeFilter} 
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
          >
            <option value="ALL">All Types</option>
            <option value="HTTP_ERROR">HTTP Errors</option>
            <option value="TIMEOUT">Timeouts</option>
            <option value="SCHEMA_DRIFT">Schema Drift</option>
            <option value="MISSING_FIELD">Missing Fields</option>
            <option value="TYPE_MISMATCH">Type Mismatch</option>
          </select>
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Status:</span>
          <select 
            className="form-select" 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open Only</option>
            <option value="DIAGNOSED">Diagnosed</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>

      </div>

      {/* Table */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        {filteredIssues.length === 0 ? (
          <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
            <CheckCircle2 size={36} style={{ color: 'var(--status-success)', margin: '0 auto 0.75rem auto' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.4rem' }}>Zero Issues Detected</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              All target APIs are matching expected JSON contracts and responding with healthy HTTP status codes.
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Issue ID & Type</th>
                  <th>Target API & Workspace</th>
                  <th>Error Details</th>
                  <th>Status</th>
                  <th>Detected At</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredIssues.map(iss => (
                  <tr key={iss.id}>
                    <td>
                      <span className="badge badge-danger" style={{ fontSize: '0.68rem' }}>{iss.issue_type}</span>
                      <div style={{ fontWeight: '700', fontSize: '0.85rem', marginTop: '2px' }}>
                        <Link to={`/issues/${iss.id}`} style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>
                          #{iss.id}
                        </Link>
                      </div>
                    </td>

                    <td>
                      <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{iss.api_name || `API #${iss.api_config_id}`}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Workspace: <strong>{iss.project_name || 'Project'}</strong>
                      </div>
                    </td>

                    <td style={{ maxWidth: '320px' }}>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {iss.error_details}
                      </div>
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
                        
                        {/* Details */}
                        <Link 
                          to={`/issues/${iss.id}`}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                          title="Open Detailed View"
                        >
                          <Eye size={12} /> Details
                        </Link>

                        {/* Drift Inspector */}
                        <button 
                          className="btn btn-secondary btn-sm"
                          onClick={() => openDriftViewer(iss)}
                          style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                          title="Compare Expected and Actual Schemas"
                        >
                          AI Fix
                        </button>

                        {/* Gemini AI Diagnosis */}
                        <button 
                          className="btn btn-primary btn-sm"
                          onClick={() => handleDiagnose(iss)}
                          disabled={diagnosingIssueId === iss.id}
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                          title="Run Gemini AI Root Cause Diagnosis"
                        >
                          <Sparkles size={12} />
                          {diagnosingIssueId === iss.id ? 'Diagnosing...' : 'Diagnose'}
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
  );
}

export default IssuesPage;
