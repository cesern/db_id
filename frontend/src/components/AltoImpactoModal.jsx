import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import { findDuplicateCapsule } from '../utils/altoImpacto';

const selectStyle = {
  width: '100%',
  padding: '0.45rem 0.6rem',
  border: '1px solid var(--border-color)',
  borderRadius: '6px',
  fontSize: '0.85rem',
  backgroundColor: 'white',
  outline: 'none'
};

// Modal para crear una cápsula personalizada de alto impacto.
// Cascada Bien -> Tipo -> Subtipo -> Modalidad vía /api/filtros (dataset=delitos).
const AltoImpactoModal = ({ onClose, onConfirm, customCapsules }) => {
  const [bien, setBien] = useState('');
  const [tipo, setTipo] = useState('');
  const [subtipo, setSubtipo] = useState('');
  const [modalidad, setModalidad] = useState('');
  const [nombre, setNombre] = useState('');
  const [opciones, setOpciones] = useState({
    bienesJuridicos: [],
    tiposDelito: [],
    subtiposDelito: [],
    modalidades: []
  });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Cascada: al cambiar un nivel se recargan los dependientes y se purgan inválidos
  useEffect(() => {
    const controller = new AbortController();
    const params = { dataset: 'delitos' };
    if (bien) params.bienJuridico = bien;
    if (tipo) params.tipoDelito = tipo;
    if (subtipo) params.subtipoDelito = subtipo;

    axios.get(`${API_URL}/api/filtros`, { params, signal: controller.signal })
      .then(res => {
        if (!res.data) return;
        setOpciones({
          bienesJuridicos: res.data.bienesJuridicos || [],
          tiposDelito: res.data.tiposDelito || [],
          subtiposDelito: res.data.subtiposDelito || [],
          modalidades: res.data.modalidades || []
        });
        if (tipo && !(res.data.tiposDelito || []).includes(tipo)) setTipo('');
        if (subtipo && !(res.data.subtiposDelito || []).includes(subtipo)) setSubtipo('');
        if (modalidad && !(res.data.modalidades || []).includes(modalidad)) setModalidad('');
      })
      .catch(err => {
        if (axios.isCancel(err)) return;
        console.error('Error fetching filtros del modal', err);
      });

    return () => controller.abort();
  }, [bien, tipo, subtipo]); // eslint-disable-line react-hooks/exhaustive-deps

  const cfg = {};
  if (bien) cfg.b = bien;
  if (tipo) cfg.t = tipo;
  if (subtipo) cfg.s = subtipo;
  if (modalidad) cfg.m = modalidad;
  const hasLevels = Object.keys(cfg).length > 0;

  const cleanName = nombre.trim();
  const badName = cleanName.length === 0 || cleanName.includes('|');
  const duplicate = hasLevels ? findDuplicateCapsule(cfg, customCapsules) : null;
  const canConfirm = hasLevels && !badName && !duplicate;

  const handleConfirm = () => {
    if (!canConfirm || !onConfirm) return;
    const payload = { n: cleanName };
    if (cfg.b) payload.b = cfg.b;
    if (cfg.t) payload.t = cfg.t;
    if (cfg.s) payload.s = cfg.s;
    if (cfg.m) payload.m = cfg.m;
    onConfirm(`CUSTOM:${JSON.stringify(payload)}`);
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onClose}
    >
      <div
        style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', maxWidth: '560px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
          Agregar delito personalizado
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Elige los niveles en cascada. Solo se envían los niveles que definas.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label className="label-sm">Bien jurídico afectado</label>
            <select className="input-select" style={selectStyle} value={bien} onChange={e => { setBien(e.target.value); setTipo(''); setSubtipo(''); setModalidad(''); }}>
              <option value="">Todos</option>
              {opciones.bienesJuridicos.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="label-sm">Tipo de delito</label>
            <select className="input-select" style={selectStyle} value={tipo} onChange={e => { setTipo(e.target.value); setSubtipo(''); setModalidad(''); }} disabled={!bien}>
              <option value="">{bien ? 'Todos' : 'Elige primero un bien jurídico'}</option>
              {opciones.tiposDelito.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="label-sm">Subtipo de delito</label>
            <select className="input-select" style={selectStyle} value={subtipo} onChange={e => { setSubtipo(e.target.value); setModalidad(''); }} disabled={!tipo}>
              <option value="">{tipo ? 'Todos' : 'Elige primero un tipo'}</option>
              {opciones.subtiposDelito.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="label-sm">Modalidad</label>
            <select className="input-select" style={selectStyle} value={modalidad} onChange={e => setModalidad(e.target.value)} disabled={!subtipo}>
              <option value="">{subtipo ? 'Todas' : 'Elige primero un subtipo'}</option>
              {opciones.modalidades.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="label-sm">Nombre de la cápsula</label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej. Mi delito grave"
              maxLength={60}
              style={{ ...selectStyle }}
            />
            {cleanName.includes('|') && (
              <p style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '0.25rem' }}>
                El nombre no puede contener el carácter "|".
              </p>
            )}
          </div>

          {duplicate && (
            <p style={{ fontSize: '0.8rem', color: '#b45309', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '6px', padding: '0.5rem 0.75rem' }}>
              Ya existe la cápsula "{duplicate}" con esta configuración.
            </p>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
          <button className="btn" onClick={onClose} style={{ padding: '0.45rem 1rem', fontSize: '0.875rem', fontWeight: 600 }}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={!canConfirm}
            title={!hasLevels ? 'Define al menos un nivel' : badName ? 'Escribe un nombre válido sin "|"' : duplicate ? 'Configuración duplicada' : 'Agregar cápsula'}
            style={{ padding: '0.45rem 1.1rem', fontSize: '0.875rem', fontWeight: 600, opacity: canConfirm ? 1 : 0.5, cursor: canConfirm ? 'pointer' : 'not-allowed' }}
          >
            Agregar cápsula
          </button>
        </div>
      </div>
    </div>
  );
};

export default AltoImpactoModal;
