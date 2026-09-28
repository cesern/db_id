import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminClient, setCsrfToken } from '../../api';
import EmptyState from '../EmptyState';
import DatasetCard from './DatasetCard';
import { fmtDate, summaryLine } from './format';

const CONJUNTOS = [
  { id: 'delitos', label: 'Delitos' },
  { id: 'victimas', label: 'Víctimas' },
  { id: 'victimas_mun', label: 'Víctimas Municipios' },
  { id: 'poblacion', label: 'Población' },
];
const LABEL = Object.fromEntries(CONJUNTOS.map((c) => [c.id, c.label]));

const ACCIONES = {
  upload: 'Subió a espera',
  publish: 'Publicó',
  restore: 'Restauró',
  discard: 'Descartó',
  login_fail: 'Acceso fallido',
  publish_failed: 'Falló al publicar',
  restore_failed: 'Falló al restaurar',
};

const Skeleton = () => (
  <div className="adm-grid" aria-hidden="true">
    {CONJUNTOS.map((c) => (
      <div key={c.id} className="adm-card adm-skeleton">
        <span className="adm-sk adm-sk-title" />
        <span className="adm-sk adm-sk-line" />
        <span className="adm-sk adm-sk-line short" />
        <span className="adm-sk adm-sk-drop" />
      </div>
    ))}
  </div>
);

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(null); // { persistent, datasets }
  const [log, setLog] = useState([]);
  const [phase, setPhase] = useState('loading'); // loading | ready | error
  const [attempt, setAttempt] = useState(0);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const toLogin = useCallback(() => {
    setCsrfToken(null);
    navigate('/admin/login', { replace: true });
  }, [navigate]);

  // Datos de las tarjetas y bitácora (sin esqueleto; se usa tras cada operación)
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [ds, lg] = await Promise.all([
        adminClient.get('/api/admin/datasets'),
        adminClient.get('/api/admin/log', { params: { limit: 50 } }),
      ]);
      setStatus(ds.data);
      setLog(Array.isArray(lg.data) ? lg.data : []);
      setRefreshFailed(false);
    } catch (err) {
      // 401 → login; otro error: se conservan las tarjetas actuales y se avisa
      if (err?.response?.status === 401) toLogin();
      else setRefreshFailed(true);
    } finally {
      setRefreshing(false);
    }
  }, [toLogin]);

  // Carga inicial: sesión (usuario + CSRF) y luego datos
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await adminClient.get('/api/admin/me');
        if (cancelled) return;
        setCsrfToken(me.data.csrf_token);
        setUser(me.data.username);
        const [ds, lg] = await Promise.all([
          adminClient.get('/api/admin/datasets'),
          adminClient.get('/api/admin/log', { params: { limit: 50 } }),
        ]);
        if (cancelled) return;
        setStatus(ds.data);
        setLog(Array.isArray(lg.data) ? lg.data : []);
        setPhase('ready');
      } catch (err) {
        if (cancelled) return;
        // Sesión vencida o firmada con otro secreto (p. ej. tras un redeploy): al login
        if (err?.response?.status === 401) toLogin();
        else setPhase('error');
      }
    })();
    return () => { cancelled = true; };
  }, [attempt, toLogin]);

  const retry = () => {
    setPhase('loading');
    setAttempt((n) => n + 1);
  };

  const logout = async () => {
    try {
      await adminClient.post('/api/admin/logout');
    } catch {
      // Aunque falle, se sale del panel
    }
    toLogin();
  };

  return (
    <div className="adm-page">
      <header className="adm-header">
        <div className="adm-header-inner">
          <div className="adm-brand">
            <img src="/logo.png" alt="" className="adm-brand-img" />
            <div>
              <h1>Administración de datos</h1>
              <span className="adm-header-rule" aria-hidden="true" />
            </div>
          </div>
          <div className="adm-header-actions">
            <Link to="/" className="adm-header-link">Ver tablero</Link>
            {user && <span className="adm-user" title="Usuario con sesión">{user}</span>}
            <button type="button" className="adm-logout" onClick={logout}>Cerrar sesión</button>
          </div>
        </div>
      </header>

      <main className="adm-main">
        {phase === 'loading' && (
          <>
            <p className="adm-sr" role="status">Cargando conjuntos de datos…</p>
            <Skeleton />
          </>
        )}

        {phase === 'error' && (
          <div className="adm-card">
            <EmptyState
              variant="error"
              inline
              title="No se pudo cargar el estado de los datos"
              detail="El servidor no respondió. Revisa tu conexión e intenta de nuevo."
              onRetry={retry}
            />
          </div>
        )}

        {phase === 'ready' && status && (
          <>
            <div aria-live="polite">
              {refreshFailed && (
                <p
                  className="adm-msg adm-msg-error"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}
                >
                  No se pudo actualizar el estado.
                  <button
                    type="button"
                    className="state-panel-retry"
                    style={{ marginTop: 0 }}
                    onClick={refresh}
                    disabled={refreshing}
                  >
                    {refreshing ? 'Reintentando…' : 'Reintentar'}
                  </button>
                </p>
              )}
            </div>
            {status.persistent === false && (
              <div className="adm-notice" role="note">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                  <path d="M12 9v4M12 17h.01" />
                </svg>
                Los cambios se perderán en el próximo despliegue (sin volumen persistente)
              </div>
            )}

            <div className="adm-grid">
              {CONJUNTOS.map((c) => (
                <DatasetCard
                  key={c.id}
                  id={c.id}
                  label={c.label}
                  info={status.datasets?.[c.id]}
                  onChanged={refresh}
                />
              ))}
            </div>

            <section className="adm-card adm-log" aria-labelledby="adm-log-title">
              <h2 id="adm-log-title">Bitácora</h2>
              {log.length === 0 ? (
                <p className="adm-muted">Sin movimientos registrados.</p>
              ) : (
                <div className="adm-log-scroll" tabIndex={0} aria-label="Bitácora de movimientos">
                  <table className="adm-log-table">
                    <thead>
                      <tr>
                        <th scope="col">Fecha</th>
                        <th scope="col">Usuario</th>
                        <th scope="col">Acción</th>
                        <th scope="col">Conjunto</th>
                        <th scope="col">Detalle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {log.map((e, i) => (
                        <tr key={`${e.at}-${i}`}>
                          <td className="tabular adm-nowrap">{fmtDate(e.at)}</td>
                          <td>{e.user || '—'}</td>
                          <td className={String(e.action).includes('fail') ? 'adm-log-bad' : undefined}>
                            {ACCIONES[e.action] || e.action}
                          </td>
                          <td>{LABEL[e.dataset] || e.dataset || '—'}</td>
                          <td className="tabular adm-muted">
                            {e.summary && typeof e.summary === 'object' ? summaryLine(e.summary) : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
