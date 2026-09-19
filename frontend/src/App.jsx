import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';

import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectWorkspacePage from './pages/ProjectWorkspacePage';
import ApisPage from './pages/ApisPage';
import ApiDetailsPage from './pages/ApiDetailsPage';
import IssuesPage from './pages/IssuesPage';
import IssueDetailsPage from './pages/IssueDetailsPage';
import MonitoringPage from './pages/MonitoringPage';
import SettingsPage from './pages/SettingsPage';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      
      {/* Protected SaaS Layout */}
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectWorkspacePage />} />
        <Route path="/apis" element={<ApisPage />} />
        <Route path="/apis/:apiId" element={<ApiDetailsPage />} />
        <Route path="/issues" element={<IssuesPage />} />
        <Route path="/issues/:issueId" element={<IssueDetailsPage />} />
        <Route path="/monitoring" element={<MonitoringPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  );
}

export default App;
