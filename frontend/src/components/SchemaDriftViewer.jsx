import React from 'react';
import { X, AlertOctagon, FileCode, Cpu, ArrowRight, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

function SchemaDriftViewer({ isOpen, onClose, issue, onDiagnose, isDiagnosing }) {
  if (!isOpen || !issue) return null;

  const validationResults = issue.schema_validation_results || {};
  const missingFields = validationResults.missing_fields || [];
  const unexpectedFields = validationResults.unexpected_fields || [];
  const typeMismatches = validationResults.type_mismatches || [];

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '850px', padding: '1.75rem' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertOctagon size={24} style={{ color: 'var(--status-danger)' }} />
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '600' }}>
                Contract Schema Drift & Issue Details #{issue.id}
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Target API: <strong>{issue.api_name || `API ID ${issue.api_config_id}`}</strong> ({issue.api_url})
              </p>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: '0.35rem 0.5rem' }}>
            <X size={18} />
          </button>
        </div>

        {/* Issue Type & Details Banner */}
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="badge badge-danger" style={{ fontSize: '0.75rem' }}>
                {issue.issue_type}
              </span>
              {issue.status_code && (
                <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>
                  HTTP {issue.status_code}
                </span>
              )}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Detected: {new Date(issue.created_at).toLocaleString()}
            </span>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '500' }}>
            {issue.error_details}
          </p>
        </div>

        {/* Drift Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          
          {/* Missing Fields */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem', color: 'var(--status-danger)' }}>
              <XCircle size={16} />
              <strong style={{ fontSize: '0.85rem' }}>Missing Fields ({missingFields.length})</strong>
            </div>
            {missingFields.length > 0 ? (
              <ul style={{ paddingLeft: '1.2rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {missingFields.map((f, i) => <li key={i} className="font-mono">{f}</li>)}
              </ul>
            ) : (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>None detected</p>
            )}
          </div>

          {/* Type Mismatches */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem', color: 'var(--status-warning)' }}>
              <AlertTriangle size={16} />
              <strong style={{ fontSize: '0.85rem' }}>Type Mismatches ({typeMismatches.length})</strong>
            </div>
            {typeMismatches.length > 0 ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {typeMismatches.map((tm, i) => (
                  <div key={i} className="font-mono" style={{ marginBottom: '4px' }}>
                    <strong>{tm.field}</strong>: exp <em>{tm.expected}</em>, got <em>{tm.actual}</em>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>None detected</p>
            )}
          </div>

          {/* Unexpected Fields */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem', color: 'var(--status-info)' }}>
              <FileCode size={16} />
              <strong style={{ fontSize: '0.85rem' }}>Extra Fields ({unexpectedFields.length})</strong>
            </div>
            {unexpectedFields.length > 0 ? (
              <ul style={{ paddingLeft: '1.2rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {unexpectedFields.map((f, i) => <li key={i} className="font-mono">{f}</li>)}
              </ul>
            ) : (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>None detected</p>
            )}
          </div>

        </div>

        {/* Side-by-Side Schema & Payload Comparison */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          
          {/* Expected Schema */}
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileCode size={14} style={{ color: 'var(--accent-cyan)' }} />
              Expected JSON Schema
            </div>
            <pre style={{
              background: '#040812',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '0.85rem',
              fontSize: '0.78rem',
              maxHeight: '220px',
              overflowY: 'auto',
              color: '#a5f3fc'
            }}>
              {JSON.stringify(issue.expected_schema || {}, null, 2)}
            </pre>
          </div>

          {/* Actual Response Payload */}
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileCode size={14} style={{ color: 'var(--status-warning)' }} />
              Actual Response Payload / Error Log
            </div>
            <pre style={{
              background: '#040812',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '0.85rem',
              fontSize: '0.78rem',
              maxHeight: '220px',
              overflowY: 'auto',
              color: '#fef08a'
            }}>
              {issue.response_body 
                ? JSON.stringify(issue.response_body, null, 2)
                : (issue.error_details || 'No payload recorded')}
            </pre>
          </div>

        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Close Inspector
          </button>

          <button 
            className="btn btn-primary"
            onClick={() => onDiagnose(issue.id)}
            disabled={isDiagnosing}
          >
            <Cpu size={16} />
            {isDiagnosing ? 'Generating Gemini Diagnosis...' : 'Diagnose with Gemini AI'}
          </button>
        </div>

      </div>
    </div>
  );
}

export default SchemaDriftViewer;
