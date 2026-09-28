import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminClient, setCsrfToken } from '../../api';

const loginError = (err) => {
  const res = err?.response;
  if (!res) return 'No se pudo conectar con el servidor. Intenta de nuevo.';
  if (res.status === 401) return 'Usuario o contraseña incorrectos';
  if (res.status === 429) {
    const segundos = Number(res.data?.retry_after);
    const n = Number.isFinite(segundos) && segundos > 0 ? Math.max(1, Math.ceil(segundos / 60)) : null;
    if (n == null) return res.data?.detail || 'Demasiados intentos, espera unos minutos';
    return `Demasiados intentos, espera ${n} ${n === 1 ? 'minuto' : 'minutos'}`;
  }
  if (res.status === 404) return 'El panel de administración no está habilitado en el servidor';
  return 'No se pudo iniciar sesión. Intenta de nuevo.';
};

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Con sesión vigente se pasa directo al panel
  useEffect(() => {
    let cancelled = false;
    adminClient.get('/api/admin/me')
      .then((res) => {
        if (cancelled) return;
        setCsrfToken(res.data.csrf_token);
        navigate('/admin/dashboard', { replace: true });
      })
      .catch(() => { /* sin sesión: se queda en el formulario */ });
    return () => { cancelled = true; };
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await adminClient.post('/api/admin/login', { username, password });
      setCsrfToken(res.data.csrf_token);
      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      setError(loginError(err));
      setLoading(false);
    }
  };

  return (
    <div className="adm-login-page">
      <div className="adm-login-card">
        <div className="adm-login-head">
          <img src="/logo.png" alt="Fiscalía General de Justicia del Estado de Sonora" className="adm-login-img" />
          <h1>Administración de datos</h1>
          <span className="adm-header-rule" aria-hidden="true" />
          <p>Ingresa tus credenciales para continuar</p>
        </div>

        <div aria-live="polite">
          {error && <p className="adm-msg adm-msg-error" role="alert">{error}</p>}
        </div>

        <form onSubmit={handleLogin} className="adm-login-form">
          <div>
            <label htmlFor="adm-user">Usuario</label>
            <input
              id="adm-user"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="adm-pass">Contraseña</label>
            <input
              id="adm-pass"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary adm-login-submit" disabled={loading}>
            {loading ? 'Iniciando sesión…' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
