import React, { useState, useEffect } from 'react';
import { 
  X, Code, CheckCircle, AlertCircle, FileJson, ArrowRight, ArrowLeft, Layers, Sliders, ShieldCheck 
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiConfigsAPI } from '../api/client';

const SAMPLE_SCHEMA = {
  "type": "object",
  "required": ["id", "title", "userId"],
  "properties": {
    "id": { "type": "integer" },
    "title": { "type": "string" },
    "userId": { "type": "integer" },
    "completed": { "type": "boolean" }
  }
};

function ApiConfigModal({ isOpen, onClose, onSaveSuccess, editingConfig }) {
  const { projects, currentProject } = useApp();

  const [step, setStep] = useState(1); // 1: Basic, 2: Request Config, 3: Expected Schema, 4: Monitoring

  // Step 1: Basic Info
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [method, setMethod] = useState('GET');
  const [environment, setEnvironment] = useState('production');
  const [projectId, setProjectId] = useState('');

  // Step 2: Request Configuration
  const [headers, setHeaders] = useState('{}');
  const [body, setBody] = useState('');

  // Step 3: Expected Response
  const [expectedStatusCode, setExpectedStatusCode] = useState(200);
  const [expectedSchema, setExpectedSchema] = useState(JSON.stringify(SAMPLE_SCHEMA, null, 2));

  // Step 4: Monitoring
  const [pollingInterval, setPollingInterval] = useState(60);
  const [isActive, setIsActive] = useState(true);

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const prevOpenRef = React.useRef(false);
  const prevConfigRef = React.useRef(null);

  useEffect(() => {
    const isTransitionToOpen = isOpen && !prevOpenRef.current;
    const isConfigChange = editingConfig?.id !== prevConfigRef.current?.id;

    if (isTransitionToOpen || isConfigChange) {
      if (editingConfig) {
        setName(editingConfig.name || '');
        setUrl(editingConfig.url || '');
        setMethod(editingConfig.method || 'GET');
        setEnvironment(editingConfig.environment || 'production');
        setProjectId(editingConfig.project_id || (currentProject?.id || ''));
        setHeaders(JSON.stringify(editingConfig.headers || {}, null, 2));
        setBody(editingConfig.body ? JSON.stringify(editingConfig.body, null, 2) : '');
        setExpectedStatusCode(editingConfig.expected_status_code || 200);
        setExpectedSchema(editingConfig.expected_schema ? JSON.stringify(editingConfig.expected_schema, null, 2) : '');
        setPollingInterval(editingConfig.polling_interval_seconds || 60);
        setIsActive(editingConfig.is_active !== undefined ? editingConfig.is_active : true);
      } else {
        setName('');
        setUrl('');
        setMethod('GET');
        setEnvironment('production');
        setProjectId(currentProject?.id || (projects.length > 0 ? projects[0].id : ''));
        setHeaders('{}');
        setBody('');
        setExpectedStatusCode(200);
        setExpectedSchema(JSON.stringify(SAMPLE_SCHEMA, null, 2));
        setPollingInterval(60);
        setIsActive(true);
      }
      setStep(1);
      setError(null);
    }
    prevOpenRef.current = isOpen;
    prevConfigRef.current = editingConfig;
  }, [editingConfig, isOpen, currentProject, projects]);

  if (!isOpen) return null;

  const validateStep = (currentStep) => {
    setError(null);
    if (currentStep === 1) {
      if (!name.trim()) {
        setError("API Name is required.");
        return false;
      }
      if (!url.trim() || !url.startsWith("http")) {
        setError("Valid target URL (starting with http:// or https://) is required.");
        return false;
      }
      if (!projectId) {
        setError("Please select a target Project Workspace.");
        return false;
      }
    } else if (currentStep === 2) {
      try {
        if (headers.trim()) JSON.parse(headers);
      } catch (err) {
        setError("Invalid JSON format for Headers.");
        return false;
      }
      try {
        if (body.trim()) JSON.parse(body);
      } catch (err) {
        setError("Invalid JSON format for Request Body.");
        return false;
      }
    } else if (currentStep === 3) {
      if (!expectedStatusCode) {
        setError("Expected HTTP status code is required.");
        return false;
      }
      try {
        if (expectedSchema.trim()) JSON.parse(expectedSchema);
      } catch (err) {
        setError("Invalid JSON format for Expected Schema.");
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(prev => Math.min(prev + 1, 4));
    }
  };

  const handleBack = () => {
    setError(null);
    setStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!validateStep(step)) return;

    let parsedHeaders = {};
    let parsedBody = null;
    let parsedSchema = null;

    try {
      if (headers.trim()) parsedHeaders = JSON.parse(headers);
      if (body.trim()) parsedBody = JSON.parse(body);
      if (expectedSchema.trim()) parsedSchema = JSON.parse(expectedSchema);
    } catch (err) {
      setError("Please verify JSON syntax in configuration fields.");
      return;
    }

    const payload = {
      project_id: parseInt(projectId, 10),
      name,
      url,
      method: method.toUpperCase(),
      environment,
      headers: parsedHeaders,
      body: parsedBody,
      expected_status_code: parseInt(expectedStatusCode, 10),
      expected_schema: parsedSchema,
      polling_interval_seconds: parseInt(pollingInterval, 10),
      is_active: Boolean(isActive)
    };

    setLoading(true);
    try {
      if (editingConfig?.id) {
        await apiConfigsAPI.update(editingConfig.id, payload);
      } else {
        await apiConfigsAPI.create(payload);
      }
      setLoading(false);
      if (onSaveSuccess) onSaveSuccess();
      onClose();
    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.detail || err.message || "Failed to register target API.");
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '680px', padding: '1.75rem' }}>
        
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileJson size={22} style={{ color: 'var(--accent-cyan)' }} />
            <h2 style={{ fontSize: '1.2rem', fontWeight: '600' }}>
              {editingConfig ? 'Edit Monitored Target API' : 'Register Monitored Target API'}
            </h2>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: '0.35rem 0.5rem' }}>
            <X size={18} />
          </button>
        </div>

        {/* Stepper Progress Indicator */}
        <div className="stepper-header">
          {[
            { num: 1, label: 'Basic Info' },
            { num: 2, label: 'Request Config' },
            { num: 3, label: 'Expected Schema' },
            { num: 4, label: 'Monitoring' }
          ].map(s => (
            <div 
              key={s.num} 
              className={`stepper-step ${step === s.num ? 'active' : step > s.num ? 'completed' : ''}`}
            >
              <div className="stepper-step-number">
                {step > s.num ? '✓' : s.num}
              </div>
              <span className="stepper-step-label">{s.label}</span>
            </div>
          ))}
        </div>

        {error && (
          <div style={{ padding: '0.85rem 1rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: 'var(--status-danger)', fontSize: '0.85rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: Basic Info */}
        {step === 1 && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">API Configuration Name *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Payments Gateway Endpoint"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">HTTP Method *</label>
                <select className="form-select" value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                  <option value="PATCH">PATCH</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Target Endpoint URL *</label>
              <input 
                type="url" 
                className="form-input" 
                placeholder="https://api.example.com/v1/resource"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Project Workspace *</label>
                <select 
                  className="form-select" 
                  value={projectId} 
                  onChange={(e) => setProjectId(e.target.value)}
                  required
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Environment *</label>
                <select className="form-select" value={environment} onChange={(e) => setEnvironment(e.target.value)}>
                  <option value="production">Production</option>
                  <option value="staging">Staging</option>
                  <option value="development">Development</option>
                </select>
              </div>
            </div>

          </div>
        )}

        {/* STEP 2: Request Configuration */}
        {step === 2 && (
          <div>
            <div className="form-group">
              <label className="form-label">Custom HTTP Headers (JSON Object)</label>
              <textarea 
                className="form-textarea"
                placeholder='{\n  "Authorization": "Bearer token",\n  "Content-Type": "application/json"\n}'
                value={headers}
                onChange={(e) => setHeaders(e.target.value)}
                style={{ minHeight: '110px' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Request Body Payload (Optional JSON)</label>
              <textarea 
                className="form-textarea"
                placeholder='{\n  "query": "search term",\n  "limit": 10\n}'
                value={body}
                onChange={(e) => setBody(e.target.value)}
                style={{ minHeight: '110px' }}
              />
            </div>
          </div>
        )}

        {/* STEP 3: Expected Schema */}
        {step === 3 && (
          <div>
            <div className="form-group">
              <label className="form-label">Expected Status Code *</label>
              <input 
                type="number" 
                className="form-input" 
                value={expectedStatusCode}
                onChange={(e) => setExpectedStatusCode(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Expected JSON Schema (Structural / Draft 7)</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
                    Upload Schema
                    <input 
                      type="file" 
                      accept=".json"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            try {
                              const parsed = JSON.parse(event.target.result);
                              setExpectedSchema(JSON.stringify(parsed, null, 2));
                              setError(null);
                            } catch (err) {
                              setError("Invalid JSON file uploaded.");
                            }
                          };
                          reader.readAsText(file);
                        }
                      }}
                    />
                  </label>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setExpectedSchema(JSON.stringify(SAMPLE_SCHEMA, null, 2))}>
                    Reset to Sample Schema
                  </button>
                </div>
              </div>
              <textarea 
                className="form-textarea"
                value={expectedSchema}
                onChange={(e) => setExpectedSchema(e.target.value)}
                style={{ minHeight: '150px' }}
              />
            </div>
          </div>
        )}

        {/* STEP 4: Monitoring */}
        {step === 4 && (
          <div>
            <div className="form-group">
              <label className="form-label">Polling Interval *</label>
              <select className="form-select" value={pollingInterval} onChange={(e) => setPollingInterval(e.target.value)}>
                <option value={10}>10 Seconds (Ultra-Fast SLA)</option>
                <option value={30}>30 Seconds (High Precision)</option>
                <option value={60}>60 Seconds (Standard Recommended)</option>
                <option value={300}>5 Minutes (Extended Interval)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Monitoring Status</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginTop: '0.5rem' }}>
                <input 
                  type="checkbox" 
                  checked={isActive} 
                  onChange={(e) => setIsActive(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--accent-cyan)' }}
                />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  Enable continuous automated health checks for this target API
                </span>
              </label>
            </div>

            <div className="glass-card" style={{ padding: '1rem', marginTop: '1.25rem', background: 'rgba(0, 242, 254, 0.05)', border: '1px solid rgba(0, 242, 254, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)', marginBottom: '0.4rem' }}>
                <ShieldCheck size={18} />
                <strong style={{ fontSize: '0.85rem' }}>Registration Ready</strong>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Target: <strong>{method} {url || 'endpoint'}</strong> will be monitored every <strong>{pollingInterval}s</strong> under project <strong>{projects.find(p => String(p.id) === String(projectId))?.name || 'Workspace'}</strong>.
              </p>
            </div>
          </div>
        )}

        {/* Modal Navigation Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.75rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <div>
            {step > 1 ? (
              <button type="button" className="btn btn-secondary" onClick={handleBack}>
                <ArrowLeft size={16} /> Back
              </button>
            ) : (
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
            )}
          </div>

          <div>
            {step < 4 ? (
              <button type="button" className="btn btn-primary" onClick={handleNext}>
                Next <ArrowRight size={16} />
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                {loading ? 'Registering API...' : editingConfig ? 'Update Target API' : 'Register Monitored API'}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default ApiConfigModal;
