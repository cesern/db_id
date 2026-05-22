import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:8000';

const AdminDashboard = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [etlStatus, setEtlStatus] = useState({ status: 'idle', message: '', details: '' });
  const [uploadMessages, setUploadMessages] = useState([]);
  
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // Verificar sesión
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/admin/me`);
        setUser(res.data.username);
        setLoading(false);
      } catch (err) {
        navigate('/admin/login');
      }
    };
    checkSession();
  }, [navigate]);

  // Polling de estado ETL
  const startPolling = () => {
    if (pollIntervalRef.current) return;
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await axios.get(`${API_URL}/api/admin/etl-status`);
        setEtlStatus(res.data);
        
        if (res.data.status === 'completed' || res.data.status === 'error') {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      } catch (err) {
        console.error("Error polling status", err);
      }
    }, 2000);
  };

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await axios.post(`${API_URL}/api/admin/logout`);
      navigate('/admin/login');
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    console.log("Archivo detectado", file);
    if (!file) return;

    // Mensaje temporal (opcional)
    // setUploadMessages(prev => [...prev, { type: 'info', text: `Subiendo ${file.name}...` }]);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${API_URL}/api/admin/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadMessages(prev => [...prev, { type: 'success', text: `Éxito: ${res.data.message}` }]);
    } catch (err) {
      setUploadMessages(prev => [...prev, { type: 'error', text: `Error en ${file.name}: ${err.response?.data?.detail || err.message}` }]);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRunETL = async () => {
    try {
      await axios.post(`${API_URL}/api/admin/run-etl`);
      setEtlStatus({ status: 'processing', message: 'Iniciando proceso en segundo plano...', details: '' });
      startPolling();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al iniciar ETL');
    }
  };

  const handleReloadDB = async () => {
    try {
      const res = await axios.post(`${API_URL}/api/admin/reload-db`);
      toast.success(res.data.message);
    } catch (err) {
      toast.error('Error recargando la BD');
    }
  };

  if (loading) return <div style={{ padding: '2rem', color: 'white', backgroundColor: '#081C3A', minHeight: '100vh' }}>Cargando sesión...</div>;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f1f5f9', fontFamily: '"Inter", sans-serif' }}>
      {/* Header Admin */}
      <header style={{ backgroundColor: '#081C3A', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <img src="/logo.png" alt="Logo" style={{ height: '40px' }} />
          <h1 style={{ color: 'white', fontSize: '1.2rem', margin: 0 }}>Panel de Administración</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: '#cbd5e1', fontSize: '0.9rem' }}>Admin: {user}</span>
          <button 
            onClick={handleLogout}
            style={{ padding: '0.5rem 1rem', backgroundColor: 'transparent', border: '1px solid #64748b', color: 'white', borderRadius: '4px', cursor: 'pointer' }}
          >
            Cerrar Sesión
          </button>
        </div>
      </header>

      <main style={{ maxWidth: '1000px', margin: '2rem auto', padding: '0 1rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Sección de Archivos */}
        <section style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
          <h2 style={{ marginTop: 0, color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>Gestión de Datos</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Sube los archivos CSV oficiales. Estos reemplazarán a los existentes en el servidor.</p>
          
          <div style={{ marginTop: '1.5rem' }}>
            <input 
              type="file" 
              accept=".csv" 
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <button 
              onClick={() => {
                console.log("Click upload");
                fileInputRef.current.click();
              }}
              style={{ padding: '0.75rem 1.5rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
            >
              Subir nuevo CSV
            </button>
            {uploadMessages.length > 0 && (
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {uploadMessages.map((msg, idx) => (
                  <p key={idx} style={{ 
                    margin: 0, 
                    padding: '0.75rem', 
                    backgroundColor: msg.type === 'error' ? '#fef2f2' : msg.type === 'info' ? '#eff6ff' : '#f0fdf4', 
                    color: msg.type === 'error' ? '#ef4444' : msg.type === 'info' ? '#3b82f6' : '#16a34a', 
                    borderRadius: '6px', 
                    fontSize: '0.9rem' 
                  }}>
                    {msg.text}
                  </p>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Sección de ETL */}
        <section style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
          <h2 style={{ marginTop: 0, color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>Procesamiento ETL & Base de Datos</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            Convierte los archivos CSV a Parquet optimizados y recarga la base de datos en memoria para el dashboard público.
          </p>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            <button 
              onClick={handleRunETL}
              disabled={etlStatus.status === 'processing'}
              style={{ padding: '0.75rem 1.5rem', backgroundColor: etlStatus.status === 'processing' ? '#94a3b8' : '#C8A96B', color: 'white', border: 'none', borderRadius: '6px', cursor: etlStatus.status === 'processing' ? 'not-allowed' : 'pointer', fontWeight: 500 }}
            >
              {etlStatus.status === 'processing' ? 'Procesando...' : 'Ejecutar Conversión ETL'}
            </button>
            <button 
              onClick={handleReloadDB}
              style={{ padding: '0.75rem 1.5rem', backgroundColor: 'transparent', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
            >
              Forzar Recarga DB
            </button>
          </div>

          {/* Consola de Estado */}
          <div style={{ marginTop: '2rem', backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '8px', color: '#f8fafc', fontFamily: 'monospace', minHeight: '150px', maxHeight: '400px', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase' }}>Consola de Estado</h3>
            
            <div style={{ marginBottom: '0.5rem' }}>
              Estado: <span style={{ 
                color: etlStatus.status === 'completed' ? '#4ade80' : 
                       etlStatus.status === 'error' ? '#f87171' : 
                       etlStatus.status === 'processing' ? '#fbbf24' : '#94a3b8' 
              }}>
                {etlStatus.status.toUpperCase()}
              </span>
            </div>
            
            {etlStatus.message && (
              <div style={{ marginBottom: '1rem', color: '#cbd5e1' }}>
                {etlStatus.message}
              </div>
            )}
            
            {etlStatus.details && (
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.85rem', color: '#94a3b8', borderTop: '1px solid #334155', paddingTop: '1rem' }}>
                {etlStatus.details}
              </pre>
            )}
          </div>
        </section>

      </main>
    </div>
  );
};

export default AdminDashboard;
