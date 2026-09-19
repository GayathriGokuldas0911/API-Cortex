import React, { useState, useEffect } from 'react';
import { X, FolderPlus, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { projectsAPI } from '../api/client';
import { useNavigate } from 'react-router-dom';

function ProjectModal({ isOpen, onClose, onSaveSuccess, editingProject }) {
  const { refreshProjects, selectProject } = useApp();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const prevOpenRef = React.useRef(false);
  const prevProjectRef = React.useRef(null);

  useEffect(() => {
    const isTransitionToOpen = isOpen && !prevOpenRef.current;
    const isProjectChange = editingProject?.id !== prevProjectRef.current?.id;

    if (isTransitionToOpen || isProjectChange) {
      if (editingProject) {
        setName(editingProject.name || '');
        setDescription(editingProject.description || '');
      } else {
        setName('');
        setDescription('');
      }
      setError(null);
    }
    prevOpenRef.current = isOpen;
    prevProjectRef.current = editingProject;
  }, [editingProject, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Project Name is required.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let savedProj;
      if (editingProject?.id) {
        savedProj = await projectsAPI.update(editingProject.id, { name, description });
      } else {
        savedProj = await projectsAPI.create({ name, description });
      }
      
      // Update global project list and select newly created project
      const projs = await refreshProjects();
      const target = projs.find(p => p.id === savedProj.id) || savedProj;
      selectProject(target);

      setLoading(false);
      if (onSaveSuccess) onSaveSuccess(target);
      onClose();
      // Navigate to project workspace
      navigate(`/projects/${target.id}`);
    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.detail || err.message || "Failed to create project workspace.");
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '500px', padding: '1.75rem' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FolderPlus size={22} style={{ color: 'var(--accent-cyan)' }} />
            <h2 style={{ fontSize: '1.2rem', fontWeight: '600' }}>
              {editingProject ? 'Edit Project Workspace' : 'Create New Project Workspace'}
            </h2>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: '0.35rem 0.5rem' }}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div style={{ padding: '0.85rem 1rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: 'var(--status-danger)', fontSize: '0.85rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Project Workspace Name *</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. Core Banking Platform, Storefront, Mobile Gateway"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea 
              className="form-textarea" 
              placeholder="Brief description of the APIs monitored under this workspace..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ minHeight: '80px', fontFamily: 'var(--font-sans)' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : editingProject ? 'Update Project' : 'Create Project'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

export default ProjectModal;
