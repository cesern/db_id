import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import PublicDashboard from './PublicDashboard';
import Login from './components/admin/Login';
import AdminDashboard from './components/admin/AdminDashboard';
import { ADMIN_ENABLED } from './api';
import './App.css';

function App() {
  return (
    <>
      <Toaster position="top-center" richColors />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PublicDashboard />} />
          {/* Rutas del admin solo si el build lo habilita; si no, caen en "*" */}
          {ADMIN_ENABLED && (
            <>
              <Route path="/admin" element={<Login />} />
              <Route path="/admin/login" element={<Login />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
            </>
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
