import React, { useState } from 'react';
import { X, Cpu, AlertTriangle, ShieldAlert, CheckCircle2, Copy, Check, Terminal, Sparkles } from 'lucide-react';

function AiDiagnosisModal({ isOpen, onClose, diagnosis, issue }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !diagnosis) return null;

  const getSeverityBadgeClass = (severity) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL': return 'badge-danger';
      case 'HIGH': return 'badge-warning';
      case 'MEDIUM': return 'badge-info';
      default: return 'badge-success';
    }
  };

  const handleCopyCode = () => {
    if (diagnosis.recommended_action) {
      navigator.clipboard.writeText(diagnosis.recommended_action);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '800px', padding: '1.75rem' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-pink))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 0 16px rgba(139, 92, 246, 0.4)'
            }}>
              <Sparkles size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: '600' }}>
                  Gemini AI Failure Diagnosis & Remediation
                </h2>
                <span className="badge badge-purple" style={{ fontSize: '0.65rem' }}>
                  gemini-3.6-flash
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Issue #{issue?.id || diagnosis.issue_id} • Target API: {issue?.api_config?.name || 'Monitored API'}
              </p>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: '0.35rem 0.5rem' }}>
            <X size={18} />
          </button>
        </div>

        {/* Severity & Root Cause Card */}
        <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--accent-cyan)', letterSpacing: '0.05em' }}>
              ROOT CAUSE ANALYSIS
            </span>
            <span className={`badge ${getSeverityBadgeClass(diagnosis.severity)}`} style={{ fontSize: '0.75rem' }}>
              SEVERITY: {diagnosis.severity?.toUpperCase()}
            </span>
          </div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            {diagnosis.root_cause}
          </h3>
        </div>

        {/* Detailed Explanation */}
        <div className="form-group" style={{ marginBottom: '1.25rem' }}>
          <h4 style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Cpu size={14} style={{ color: 'var(--accent-blue)' }} />
            Diagnostic Explanation
          </h4>
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.9rem', fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: '1.6' }}>
            {diagnosis.explanation}
          </div>
        </div>

        {/* Possible Business Impact */}
        <div className="form-group" style={{ marginBottom: '1.25rem' }}>
          <h4 style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--status-warning)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={14} />
            Possible Downstream Impact
          </h4>
          <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '8px', padding: '0.9rem', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
            {diagnosis.possible_impact}
          </div>
        </div>

        {/* Recommended Action & Fix */}
        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--status-success)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Terminal size={14} />
              Recommended Action & Code Fix
            </h4>
            <button className="btn btn-secondary btn-sm" onClick={handleCopyCode} style={{ fontSize: '0.75rem' }}>
              {copied ? <Check size={14} style={{ color: 'var(--status-success)' }} /> : <Copy size={14} />}
              {copied ? 'Copied to Clipboard' : 'Copy Fix'}
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
            maxHeight: '250px',
            overflowY: 'auto'
          }}>
            {diagnosis.recommended_action}
          </pre>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Close Diagnosis
          </button>
        </div>

      </div>
    </div>
  );
}

export default AiDiagnosisModal;
