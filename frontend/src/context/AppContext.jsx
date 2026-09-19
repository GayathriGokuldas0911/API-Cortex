import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  authAPI, projectsAPI, apiConfigsAPI, issuesAPI, dashboardAPI, monitoringAPI, getAuthToken, setAuthToken 
} from '../api/client';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(getAuthToken());
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProjectState] = useState(null);
  const [systemHealth, setSystemHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  // Global Modals State
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [editingApiConfig, setEditingApiConfig] = useState(null);

  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  
  const [isDriftViewerOpen, setIsDriftViewerOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState(null);

  const [isDiagnosisModalOpen, setIsDiagnosisModalOpen] = useState(false);
  const [selectedDiagnosis, setSelectedDiagnosis] = useState(null);

  // Load User and Projects
  const refreshProjects = useCallback(async () => {
    try {
      const projs = await projectsAPI.getAll();
      setProjects(projs || []);
      
      // If there's a stored project ID in localStorage, select it
      const savedProjId = localStorage.getItem('api_cortex_active_project_id');
      if (savedProjId && projs?.length) {
        const found = projs.find(p => String(p.id) === String(savedProjId));
        if (found) setCurrentProjectState(found);
      }
      return projs;
    } catch (err) {
      console.warn("Failed to load projects:", err);
      return [];
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const activeToken = getAuthToken();
    if (!activeToken) {
      setUser(null);
      return null;
    }
    try {
      const me = await authAPI.getMe();
      setUser(me);
      return me;
    } catch (err) {
      console.warn("Auth token invalid or expired");
      setAuthToken(null);
      setTokenState(null);
      setUser(null);
      return null;
    }
  }, []);

  const refreshHealth = useCallback(async () => {
    try {
      const health = await dashboardAPI.getHealth();
      setSystemHealth(health);
    } catch (err) {
      setSystemHealth({ status: 'unhealthy', database: 'unreachable' });
    }
  }, []);

  // Initial Boot
  useEffect(() => {
    async function boot() {
      setLoading(true);
      await Promise.all([refreshUser(), refreshHealth()]);
      if (getAuthToken()) {
        await refreshProjects();
      }
      setLoading(false);
    }
    boot();

    // Auto-refresh health every 20s
    const interval = setInterval(refreshHealth, 20000);
    return () => clearInterval(interval);
  }, [refreshUser, refreshProjects, refreshHealth]);

  const selectProject = useCallback((project) => {
    setCurrentProjectState(project);
    if (project?.id) {
      localStorage.setItem('api_cortex_active_project_id', String(project.id));
    } else {
      localStorage.removeItem('api_cortex_active_project_id');
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await authAPI.login(email, password);
    setTokenState(data.access_token);
    await refreshUser();
    const projs = await refreshProjects();
    if (projs?.length && !currentProject) {
      selectProject(projs[0]);
    }
    return data;
  }, [refreshUser, refreshProjects, currentProject, selectProject]);

  const register = useCallback(async (email, password, fullName) => {
    await authAPI.register(email, password, fullName);
    return await login(email, password);
  }, [login]);

  const logout = useCallback(() => {
    authAPI.logout();
    setTokenState(null);
    setUser(null);
    setProjects([]);
    setCurrentProjectState(null);
    localStorage.removeItem('api_cortex_active_project_id');
  }, []);

  const openApiModal = useCallback((config = null) => {
    setEditingApiConfig(config);
    setIsApiModalOpen(true);
  }, []);

  const closeApiModal = useCallback(() => {
    setEditingApiConfig(null);
    setIsApiModalOpen(false);
  }, []);

  const openProjectModal = useCallback((proj = null) => {
    setEditingProject(proj);
    setIsProjectModalOpen(true);
  }, []);

  const closeProjectModal = useCallback(() => {
    setEditingProject(null);
    setIsProjectModalOpen(false);
  }, []);

  const openDriftViewer = useCallback((issue) => {
    setSelectedIssue(issue);
    setIsDriftViewerOpen(true);
  }, []);

  const closeDriftViewer = useCallback(() => {
    setSelectedIssue(null);
    setIsDriftViewerOpen(false);
  }, []);

  const openDiagnosisModal = useCallback((diagnosis, issue) => {
    setSelectedDiagnosis(diagnosis);
    setSelectedIssue(issue);
    setIsDiagnosisModalOpen(true);
  }, []);

  const closeDiagnosisModal = useCallback(() => {
    setSelectedDiagnosis(null);
    setIsDiagnosisModalOpen(false);
  }, []);

  const contextValue = React.useMemo(() => ({
    user,
    token,
    projects,
    currentProject,
    systemHealth,
    loading,
    login,
    register,
    logout,
    selectProject,
    refreshProjects,
    refreshUser,
    refreshHealth,
    
    // Modals
    isApiModalOpen,
    editingApiConfig,
    openApiModal,
    closeApiModal,

    isProjectModalOpen,
    editingProject,
    openProjectModal,
    closeProjectModal,

    isAuthModalOpen,
    setIsAuthModalOpen,

    isDriftViewerOpen,
    selectedIssue,
    openDriftViewer,
    closeDriftViewer,

    isDiagnosisModalOpen,
    selectedDiagnosis,
    openDiagnosisModal,
    closeDiagnosisModal
  }), [
    user,
    token,
    projects,
    currentProject,
    systemHealth,
    loading,
    login,
    register,
    logout,
    selectProject,
    refreshProjects,
    refreshUser,
    refreshHealth,
    isApiModalOpen,
    editingApiConfig,
    openApiModal,
    closeApiModal,
    isProjectModalOpen,
    editingProject,
    openProjectModal,
    closeProjectModal,
    isAuthModalOpen,
    isDriftViewerOpen,
    selectedIssue,
    openDriftViewer,
    closeDriftViewer,
    isDiagnosisModalOpen,
    selectedDiagnosis,
    openDiagnosisModal,
    closeDiagnosisModal
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);

