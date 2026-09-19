import React, { useState } from 'react';
import { Play, Edit3, Trash2, Server, ExternalLink, Clock, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';

function ApiList({ apiConfigs, onEdit, onDelete, onTriggerCheck, checkingApiId }) {
  if (!apiConfigs || apiConfigs.length === 0) {
    return (
      <div className="glass-card" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'rgba(0, 242, 254, 0.1)',
          color: 'var(--accent-cyan)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1rem auto'
        }}>
          <Server size={28} />
        </div>
        <h3 style={{ fontSize: '1.15rem', fontWeight: '600', marginBottom: '0.5rem' }}>No Target APIs Registered</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '440px', margin: '0 auto 1.5rem auto' }}>
          Start monitoring external API endpoints and validating structural JSON schemas by adding your first target API.
        </p>
      </div>
    );
  }

  const getMethodBadgeClass = (method) => {
    switch (method.toUpperCase()) {
      case 'GET': return 'badge-info';
      case 'POST': return 'badge-success';
      case 'PUT': return 'badge-warning';
      case 'DELETE': return 'badge-danger';
      default: return 'badge-purple';
    }
  };

  return (
    <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Server size={20} style={{ color: 'var(--accent-cyan)' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: '600' }}>Monitored Target APIs</h3>
          <span className="badge badge-purple" style={{ fontSize: '0.75rem' }}>{apiConfigs.length} Active</span>
        </div>
      </div>

      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Method</th>
              <th>API Name & Target URL</th>
              <th>Expected Status</th>
              <th>Polling Interval</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {apiConfigs.map((config) => {
              const isChecking = checkingApiId === config.id;

              return (
                <tr key={config.id}>
                  
                  {/* Method */}
                  <td style={{ width: '90px' }}>
                    <span className={`badge ${getMethodBadgeClass(config.method)}`}>
                      {config.method}
                    </span>
                  </td>

                  {/* Name & URL */}
                  <td>
                    <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{config.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      <span className="font-mono" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '320px' }}>
                        {config.url}
                      </span>
                      <a href={config.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)', display: 'inline-flex' }}>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </td>

                  {/* Expected Status Code */}
                  <td>
                    <span className="font-mono" style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                      HTTP {config.expected_status_code}
                    </span>
                  </td>

                  {/* Interval */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <Clock size={14} />
                      <span>{config.polling_interval_seconds}s</span>
                    </div>
                  </td>

                  {/* Health Badge */}
                  <td>
                    <span className="badge badge-success" style={{ gap: '4px' }}>
                      <CheckCircle size={12} /> Active
                    </span>
                  </td>

                  {/* Actions */}
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      
                      {/* Manual Poll Trigger */}
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => onTriggerCheck(config.id)}
                        disabled={isChecking}
                        title="Trigger Immediate Manual Poll Check"
                        style={{ padding: '0.4rem 0.75rem' }}
                      >
                        <RefreshCw size={14} className={isChecking ? 'spin-loader' : ''} style={{ color: 'var(--accent-cyan)' }} />
                        <span style={{ fontSize: '0.8rem' }}>{isChecking ? 'Checking...' : 'Check Now'}</span>
                      </button>

                      {/* Edit */}
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => onEdit(config)}
                        title="Edit Configuration & Expected Schema"
                        style={{ padding: '0.4rem 0.5rem' }}
                      >
                        <Edit3 size={14} />
                      </button>

                      {/* Delete */}
                      <button 
                        className="btn btn-danger btn-sm"
                        onClick={() => onDelete(config.id)}
                        title="Delete API Configuration"
                        style={{ padding: '0.4rem 0.5rem' }}
                      >
                        <Trash2 size={14} />
                      </button>

                    </div>
                  </td>

                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ApiList;
