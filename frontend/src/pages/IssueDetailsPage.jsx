import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  AlertOctagon, ArrowLeft, Cpu, Sparkles, CheckCircle2, AlertTriangle, 
  XCircle, FileCode, Clock, Server, Terminal, Copy, Check 
} from 'lucide-react';
import { issuesAPI } from '../api/client';
import { useApp } from '../context/AppContext';

function IssueDetailsPage() {
  const { issueId } = useParams();
  const navigate = useNavigate();
  const { openDiagnosisModal } = useApp();

  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [diagnosing, setDiagnosing] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadIssue = useCallback(async () => {
    if (!issueId) return;
    setLoading(true);
    try {
      const data = await issuesAPI.getById(issueId);
      setIssue(data);
    } catch (err) {
      console.error("Failed to load issue details:", err);
      if (err.response?.status === 404 || err.response?.status === 403) {
        alert("Issue not found or unauthorized.");
        navigate('/issues');
      }
    } finally {
      setLoading(false);
    }
  }, [issueId, navigate]);

  useEffect(() => {
    loadIssue();
  }, [loadIssue]);

  const handleRunDiagnosis = async () => {
    setDiagnosing(true);
    try {
      const diagnosis = await issuesAPI.diagnose(issueId);
      await loadIssue();
      openDiagnosisModal(diagnosis, issue);
    } catch (err) {
      alert(err.response?.data?.detail || "Gemini AI diagnosis failed.");
    } finally {
      setDiagnosing(false);
    }
  };

  const handleCopyRemediation = (code) => {
    if (code) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading && !issue) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading issue details...</div>;
  }

  const validationResults = issue?.schema_validation_results || {};
  const missingFields = validationResults.missing_fields || [];
  const unexpectedFields = validationResults.unexpected_fields || [];
  const typeMismatches = validationResults.type_mismatches || [];
  const diag = issue?.ai_diagnosis;

  return (
    <div>
      {/* Top Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <Link to="/issues" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
          <ArrowLeft size={15} /> Back to Issues & Drift
        </Link>

        <button 
          className="btn btn-primary btn-sm"
          onClick={handleRunDiagnosis}
          disabled={diagnosing}
          style={{ gap: '6px' }}
        >
          <Sparkles size={14} />
          {diagnosing ? 'Running Gemini Diagnosis...' : diag ? 'Re-run Gemini AI Diagnosis' : 'Run Gemini AI Diagnosis'}
        </button>
      </div>

      {/* Main Issue Header Card */}
      <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
          <span className="badge badge-danger" style={{ fontSize: '0.75rem' }}>{issue?.issue_type}</span>
          <h1 style={{ fontSize: '1.4rem', fontWeight: '700' }}>Issue #{issue?.id}</h1>
          <span className={`badge ${issue?.status === 'DIAGNOSED' ? 'badge-purple' : 'badge-warning'}`}>
            {issue?.status}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', fontSize: '0.85rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          <span>Target API: <strong>{issue?.api_name}</strong></span>
          <span>Workspace: <strong>{issue?.project_name}</strong></span>
          {issue?.status_code && <span>HTTP Status: <strong>{issue?.status_code}</strong></span>}
          <span>Detected: <strong>{new Date(issue?.created_at).toLocaleString()}</strong></span>
        </div>

        <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
          <strong>Failure Description:</strong> {issue?.error_details}
        </div>
      </div>

      {/* Schema Drift Breakdown Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        
        {/* Missing Fields */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem', color: 'var(--status-danger)' }}>
            <XCircle size={18} />
            <h3 style={{ fontSize: '0.9rem', fontWeight: '600' }}>Missing Fields ({missingFields.length})</h3>
          </div>
          {missingFields.length > 0 ? (
            <ul style={{ paddingLeft: '1.2rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {missingFields.map((f, i) => <li key={i} className="font-mono">{f}</li>)}
            </ul>
          ) : (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>None</p>
          )}
        </div>

        {/* Type Mismatches */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem', color: 'var(--status-warning)' }}>
            <AlertTriangle size={18} />
            <h3 style={{ fontSize: '0.9rem', fontWeight: '600' }}>Type Mismatches ({typeMismatches.length})</h3>
          </div>
          {typeMismatches.length > 0 ? (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {typeMismatches.map((tm, i) => (
                <div key={i} className="font-mono" style={{ marginBottom: '4px' }}>
                  <strong>{tm.field}</strong>: expected <em>{tm.expected}</em>, received <em>{tm.actual}</em>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>None</p>
          )}
        </div>

        {/* Unexpected Fields */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem', color: 'var(--status-info)' }}>
            <FileCode size={18} />
            <h3 style={{ fontSize: '0.9rem', fontWeight: '600' }}>Extra Fields ({unexpectedFields.length})</h3>
          </div>
          {unexpectedFields.length > 0 ? (
            <ul style={{ paddingLeft: '1.2rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {unexpectedFields.map((f, i) => <li key={i} className="font-mono">{f}</li>)}
            </ul>
          ) : (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>None</p>
          )}
        </div>

      </div>

      {/* Google Gemini AI Diagnosis Section */}
      <div className="glass-card" style={{ padding: '1.75rem', marginBottom: '1.5rem', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-pink))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff'
            }}>
              <Sparkles size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: '700' }}>AI Diagnosis & Remediation</h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--accent-purple)', fontWeight: '600' }}>
                Powered by Google Gemini (gemini-3.6-flash)
              </span>
            </div>
          </div>

          {diag && (
            <span className={`badge ${diag.severity === 'CRITICAL' ? 'badge-danger' : diag.severity === 'HIGH' ? 'badge-warning' : 'badge-info'}`} style={{ fontSize: '0.75rem' }}>
              SEVERITY: {diag.severity}
            </span>
          )}
        </div>

        {diag ? (
          <div>
            {/* Root Cause */}
            <div style={{ marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--accent-cyan)' }}>ROOT CAUSE</span>
              <p style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                {diag.root_cause}
              </p>
            </div>

            {/* Explanation */}
            <div style={{ marginBottom: '1rem', background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)' }}>EXPLANATION</span>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.3rem', lineHeight: '1.6' }}>
                {diag.explanation}
              </p>
            </div>

            {/* Impact */}
            <div style={{ marginBottom: '1rem', background: 'rgba(245, 158, 11, 0.08)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--status-warning)' }}>POSSIBLE DOWNSTREAM IMPACT</span>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginTop: '0.3rem' }}>
                {diag.possible_impact}
              </p>
            </div>

            {/* Actionable Code Remediation */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--status-success)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Terminal size={14} /> RECOMMENDED ACTION & CODE REMEDIATION
                </span>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleCopyRemediation(diag.recommended_action)}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                >
                  {copied ? <Check size={12} style={{ color: 'var(--status-success)' }} /> : <Copy size={12} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre style={{
                background: '#040812',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '8px',
                padding: '1rem',
                fontSize: '0.82rem',
                whiteSpace: 'pre-wrap',
                color: '#a7f3d0',
                maxHeight: '260px',
                overflowY: 'auto'
              }}>
                {diag.recommended_action}
              </pre>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              No diagnosis generated yet for this issue. Let Google Gemini analyze the failure payload and recommend code fixes.
            </p>
            <button className="btn btn-primary" onClick={handleRunDiagnosis} disabled={diagnosing}>
              <Sparkles size={16} />
              {diagnosing ? 'Analyzing failure...' : 'Run Gemini AI Diagnosis'}
            </button>
          </div>
        )}
      </div>

    </div>
  );
}

export default IssueDetailsPage;
