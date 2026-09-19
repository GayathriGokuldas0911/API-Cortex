import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import { TrendingUp, BarChart2, Activity } from 'lucide-react';

function MetricsCharts({ monitoringLogs, issues }) {
  // Format monitoring logs for line chart
  const latencyData = (monitoringLogs || []).slice(-15).map(log => ({
    time: new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    latency: Math.round(log.response_time_ms || 0),
    status: log.status_code,
    healthy: log.is_healthy
  }));

  // Aggregate issues by issue_type for bar chart
  const issueCounts = {};
  (issues || []).forEach(issue => {
    const type = issue.issue_type || 'UNKNOWN';
    issueCounts[type] = (issueCounts[type] || 0) + 1;
  });

  const issueData = Object.keys(issueCounts).map(type => ({
    name: type,
    count: issueCounts[type]
  }));

  const COLORS = ['#ef4444', '#f59e0b', '#8b5cf6', '#3b82f6', '#06b6d4'];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
      
      {/* Chart 1: Latency Trend */}
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={18} style={{ color: 'var(--accent-cyan)' }} />
            <h4 style={{ fontSize: '0.95rem', fontWeight: '600' }}>Response Latency Trend (ms)</h4>
          </div>
          <span className="badge badge-purple" style={{ fontSize: '0.65rem' }}>Real-time</span>
        </div>

        {latencyData.length > 0 ? (
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <LineChart data={latencyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={11} unit="ms" />
                <Tooltip 
                  contentStyle={{ background: '#0d121f', borderColor: 'var(--border-color)', borderRadius: '8px', color: '#fff' }}
                  itemStyle={{ color: 'var(--accent-cyan)' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="latency" 
                  stroke="var(--accent-cyan)" 
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: 'var(--accent-cyan)' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No monitoring log data recorded yet.
          </div>
        )}
      </div>

      {/* Chart 2: Issue Distribution */}
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart2 size={18} style={{ color: 'var(--status-danger)' }} />
            <h4 style={{ fontSize: '0.95rem', fontWeight: '600' }}>Contract & Issue Breakdown</h4>
          </div>
          <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>Schema Drift</span>
        </div>

        {issueData.length > 0 ? (
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={issueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} />
                <YAxis stroke="var(--text-muted)" fontSize={11} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ background: '#0d121f', borderColor: 'var(--border-color)', borderRadius: '8px', color: '#fff' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {issueData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--status-success)', fontSize: '0.85rem', gap: '8px' }}>
            <Activity size={18} /> Clean Health State (0 Contract Issues)
          </div>
        )}
      </div>

    </div>
  );
}

export default MetricsCharts;
