import React from 'react';
import { Server, Activity, AlertTriangle, Zap, CheckCircle2, Clock } from 'lucide-react';

function HealthStatusCards({ summary }) {
  const totalApis = summary?.total_apis ?? 0;
  const activeApis = summary?.active_apis ?? 0;
  const availabilityRate = summary?.availability_percentage ?? 100.0;
  const avgResponseTimeMs = summary?.avg_response_time_ms ?? 0;
  const openIssuesCount = summary?.open_issues_count ?? 0;
  const criticalIssuesCount = summary?.critical_issues_count ?? 0;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      gap: '1.25rem',
      marginBottom: '2rem'
    }}>
      
      {/* Card 1: Total APIs */}
      <div className="glass-card glass-card-interactive" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
            MONITORED TARGET APIS
          </span>
          <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(0, 242, 254, 0.1)', color: 'var(--accent-cyan)' }}>
            <Server size={20} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: '700' }}>{totalApis}</h2>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          Continuous HTTP contract polling
        </p>
      </div>

      {/* Card 2: Availability */}
      <div className="glass-card glass-card-interactive" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
            AVAILABILITY RATE
          </span>
          <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-success)' }}>
            <CheckCircle2 size={20} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <h2 style={{
            fontSize: '2rem',
            fontWeight: '700',
            color: availabilityRate >= 95 ? 'var(--status-success)' : availabilityRate >= 80 ? 'var(--status-warning)' : 'var(--status-danger)'
          }}>
            {availabilityRate.toFixed(1)}%
          </h2>
          <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>24H SLA</span>
        </div>

      </div>

      {/* Card 3: Avg Response Time */}
      <div className="glass-card glass-card-interactive" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
            AVG RESPONSE TIME
          </span>
          <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-danger)' }}>
            <Clock size={20} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: '700' }}>
            {Math.round(avgResponseTimeMs)}<span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>ms</span>
          </h2>
        </div>
      </div>

    </div>
  );
}

export default HealthStatusCards;
