import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import ApiConfigModal from './ApiConfigModal';
import ProjectModal from './ProjectModal';
import SchemaDriftViewer from './SchemaDriftViewer';
import AiDiagnosisModal from './AiDiagnosisModal';
import { useApp } from '../context/AppContext';
import { issuesAPI } from '../api/client';

function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  const { 
    token, loading,
    isApiModalOpen, closeApiModal, editingApiConfig,
    isProjectModalOpen, closeProjectModal, editingProject,
    isDriftViewerOpen, closeDriftViewer, selectedIssue,
    isDiagnosisModalOpen, closeDiagnosisModal, selectedDiagnosis, openDiagnosisModal,
    refreshProjects
  } = useApp();

  const handleDiagnose = async (issueId) => {
    setIsDiagnosing(true);
    try {
      const res = await issuesAPI.diagnose(issueId);
      closeDriftViewer();
      openDiagnosisModal(res, selectedIssue);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to generate Gemini AI diagnosis.");
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleApiSaveSuccess = React.useCallback(() => {
    refreshProjects();
    window.dispatchEvent(new CustomEvent('api_cortex_refresh'));
  }, [refreshProjects]);

  const handleProjectSaveSuccess = React.useCallback(() => {
    refreshProjects();
    window.dispatchEvent(new CustomEvent('api_cortex_refresh'));
  }, [refreshProjects]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        color: 'var(--text-secondary)'
      }}>
        Initializing API Cortex...
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <Sidebar 
        mobileOpen={mobileOpen} 
        onCloseMobile={() => setMobileOpen(false)} 
      />

      {/* Main Workspace Area */}
      <div className="app-main-area">
        <TopBar onToggleMobile={() => setMobileOpen(!mobileOpen)} />
        
        <main className="app-content">
          <Outlet />
        </main>
      </div>

      {/* Global Modals */}
      <ApiConfigModal
        isOpen={isApiModalOpen}
        onClose={closeApiModal}
        onSaveSuccess={handleApiSaveSuccess}
        editingConfig={editingApiConfig}
      />

      <ProjectModal 
        isOpen={isProjectModalOpen}
        onClose={closeProjectModal}
        onSaveSuccess={handleProjectSaveSuccess}
        editingProject={editingProject}
      />

      <SchemaDriftViewer
        isOpen={isDriftViewerOpen}
        onClose={closeDriftViewer}
        issue={selectedIssue}
        onDiagnose={handleDiagnose}
        isDiagnosing={isDiagnosing}
      />

      <AiDiagnosisModal 
        isOpen={isDiagnosisModalOpen}
        onClose={closeDiagnosisModal}
        diagnosis={selectedDiagnosis}
        issue={selectedIssue}
      />
    </div>
  );
}

export default Layout;
