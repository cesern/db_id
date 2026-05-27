import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import PublicDashboard from './PublicDashboard';
import Login from './components/admin/Login';
import AdminDashboard from './components/admin/AdminDashboard';
import './App.css';

// Componente para proteger rutas administrativas
const ProtectedRoute = ({ children }) => {
  return children;
};

function App() {
  return (
    <>
      <Toaster position="top-center" richColors />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PublicDashboard />} />
          <Route path="/admin" element={<Login />} />
          <Route path="/admin/login" element={<Login />} />
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
