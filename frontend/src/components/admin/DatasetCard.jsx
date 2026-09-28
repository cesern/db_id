import React, { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminClient } from '../../api';
import ConfirmDialog from './ConfirmDialog';
import { fmtDate, num, shortMonth, signed, summaryLine, yearRange } from './format';

const errorText = (err, fallback) => {
  if (!err?.response) return 'No se pudo conectar con el servidor. Intenta de nuevo.';
  const d = err.response.data?.detail;
  return typeof d === 'string' && d ? d : fallback;
};

/** Cambio marcado (fondo dorado tenue) o texto atenuado si no cambió. */
const Delta = ({ changed, children }) => (
  <span className={changed ? 'adm-diff' : 'adm-nodiff'}>{children}</span>
);

/** Resumen de lo que está en espera, con diferencias contra lo publicado. */
const StagingSummary = ({ s }) => {
  const d = s.diff || {};
  const hasPublished = d.rows?.before != null;
  const yearChanged = d.year_max && d.year_max.before !== d.year_max.after;
  const monthChanged = d.last_month && d.last_month.before !== d.last_month.after;
  const items = [];

  const rango = yearRange(s);
  if (rango) {
    items.push(
      <li key="anios">
        {rango}
        {hasPublished && yearChanged && d.year_max.before != null && (
          <> <Delta changed>(antes hasta {d.year_max.before})</Delta></>
        )}
      </li>
    );
  }

  if (s.last_month) {
    const antes = d.last_month?.before
      ? `antes ${shortMonth(d.last_month.before)}${yearChanged ? ` ${d.year_max.before}` : ''}`
      : null;
    items.push(
      <li key="mes">
        hasta {shortMonth(s.last_month)} {s.year_max}
        {hasPublished && antes && (
          <> <Delta changed={monthChanged || yearChanged}>({(monthChanged || yearChanged) ? antes : 'sin cambio'})</Delta></>
        )}
      </li>
    );
  }

  if (s.total_last_year != null) {
    const antes = d.total_last_year?.before;
    const comparable = hasPublished && !yearChanged && antes != null;
    const delta = comparable ? s.total_last_year - antes : null;
    items.push(
      <li key="total">
        total {s.year_max}: <span className="tabular">{num(s.total_last_year)}</span>
        {comparable && (
          <> <Delta changed={delta !== 0}>({signed(delta)} en {s.year_max})</Delta></>
        )}
      </li>
    );
  }

  const deltaRows = hasPublished ? s.rows - d.rows.before : null;
  items.push(
    <li key="filas">
      <span className="tabular">{num(s.rows)}</span> filas
      {deltaRows != null && (
        <> <Delta changed={deltaRows !== 0}>({deltaRows === 0 ? 'sin cambio' : signed(deltaRows)})</Delta></>
      )}
    </li>
  );

  return <ul className="adm-summary-list">{items}</ul>;
};

const DatasetCard = ({ id, label, info, onChanged }) => {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const publishedRef = useRef(null);
  const headingId = useId();
  const [busy, setBusy] = useState(null); // 'upload' | 'publish' | 'discard' | 'restore'
  const [progress, setProgress] = useState(null);
  const [message, setMessage] = useState(null); // { kind: 'ok'|'error', text }
  const [dragOver, setDragOver] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [flash, setFlash] = useState(null); // marca breve tras publicar/restaurar

  const published = info?.published || null;
  const staging = info?.staging || null;

  useEffect(() => {
    if (!flash) return undefined;
    const t = setTimeout(() => setFlash(null), 3000);
    return () => clearTimeout(t);
  }, [flash]);

  const handleError = (err, fallback) => {
    if (err?.response?.status === 401) {
      navigate('/admin/login', { replace: true });
      return;
    }
    setMessage({ kind: 'error', text: errorText(err, fallback) });
  };

  const upload = async (file) => {
    if (!file || busy) return;
    if (!file.name.toLowerCase().endsWith('.parquet')) {
      setMessage({ kind: 'error', text: 'Solo se aceptan archivos .parquet' });
      return;
    }
    setBusy('upload');
    setProgress(0);
    setMessage({ kind: 'info', text: `Subiendo ${file.name}…` });
    const form = new FormData();
    form.append('file', file);
    try {
      await adminClient.post(`/api/admin/datasets/${id}/upload`, form, {
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded * 100) / e.total));
        },
      });
      setMessage({ kind: 'ok', text: `${file.name} quedó en espera. Revisa el resumen antes de publicar.` });
      await onChanged?.();
    } catch (err) {
      handleError(err, 'No se pudo subir el archivo');
    } finally {
      setBusy(null);
      setProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const publish = async () => {
    if (busy) return;
    setBusy('publish');
    setMessage(null);
    try {
      await adminClient.post(`/api/admin/datasets/${id}/publish`);
      setMessage({ kind: 'ok', text: `${label}: versión publicada. El tablero ya usa los datos nuevos.` });
      setFlash('Publicado');
      await onChanged?.();
      publishedRef.current?.focus();
    } catch (err) {
      handleError(err, 'No se pudo publicar');
    } finally {
      setBusy(null);
    }
  };

  const discard = async () => {
    if (busy) return;
    setBusy('discard');
    setMessage(null);
    try {
      await adminClient.delete(`/api/admin/datasets/${id}/staging`);
      setMessage({ kind: 'ok', text: 'Se descartó el archivo en espera.' });
      await onChanged?.();
      publishedRef.current?.focus();
    } catch (err) {
      handleError(err, 'No se pudo descartar');
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    setConfirmOpen(false);
    if (busy) return;
    setBusy('restore');
    setMessage(null);
    try {
      await adminClient.post(`/api/admin/datasets/${id}/restore`);
      setMessage({ kind: 'ok', text: `${label}: se restauró la versión anterior.` });
      setFlash('Restaurado');
      await onChanged?.();
    } catch (err) {
      handleError(err, 'No se pudo restaurar');
    } finally {
      setBusy(null);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) upload(file);
  };

  const backupWhen = info?.backup?.at ? fmtDate(info.backup.at, false) : null;

  return (
    <section className="adm-card" aria-labelledby={headingId} aria-busy={busy ? 'true' : 'false'}>
      <header className="adm-card-head">
        <h2 id={headingId}>{label}</h2>
        {flash && <span className="adm-flash" aria-hidden="true">✓ {flash}</span>}
      </header>

      <div className="adm-block" ref={publishedRef} tabIndex={-1}>
        <span className="adm-block-label">Publicado</span>
        {published ? (
          <p className="adm-summary tabular">
            {summaryLine(published)} · publicado {fmtDate(published.at)}
          </p>
        ) : (
          <p className="adm-summary adm-muted">Sin datos publicados</p>
        )}
      </div>

      {staging && (
        <div className="adm-block adm-staging">
          <span className="adm-block-label">En espera · subido {fmtDate(staging.at)}</span>
          <StagingSummary s={staging} />
          {staging.negative_rows > 0 && (
            <p className="adm-warn">
              {num(staging.negative_rows)} {staging.negative_rows === 1 ? 'fila' : 'filas'} con valores negativos (ajustes de la fuente)
            </p>
          )}
          <div className="adm-actions">
            <button type="button" className="btn btn-primary" onClick={publish} disabled={!!busy}>
              {busy === 'publish' ? 'Publicando…' : 'Publicar'}
            </button>
            <button type="button" className="btn" onClick={discard} disabled={!!busy}>
              {busy === 'discard' ? 'Descartando…' : 'Descartar'}
            </button>
          </div>
        </div>
      )}

      <div
        className={`adm-drop${dragOver ? ' is-over' : ''}${busy === 'upload' ? ' is-busy' : ''}`}
        onDragOver={(e) => { e.preventDefault(); if (!busy) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {busy === 'upload' ? (
          <div className="adm-progress-wrap">
            <span>{progress != null && progress < 100 ? `Subiendo… ${progress}%` : 'Validando archivo…'}</span>
            <div
              className="adm-progress"
              role="progressbar"
              aria-label={`Subida de ${label}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress ?? 0}
            >
              <div className="adm-progress-bar" style={{ transform: `scaleX(${(progress ?? 0) / 100})` }} />
            </div>
          </div>
        ) : (
          <>
            <span className="adm-drop-text">
              {staging ? 'Arrastra otro .parquet para reemplazar el que está en espera, o' : 'Arrastra aquí un archivo .parquet, o'}
            </span>
            <button
              type="button"
              className="btn"
              onClick={() => inputRef.current?.click()}
              disabled={!!busy}
            >
              Elegir archivo
            </button>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".parquet"
          hidden
          aria-label={`Archivo Parquet de ${label}`}
          onChange={(e) => upload(e.target.files?.[0])}
        />
      </div>

      <div aria-live="polite" className="adm-live">
        {message && (
          <p className={`adm-msg adm-msg-${message.kind}`}>{message.text}</p>
        )}
      </div>

      {info?.has_backup && (
        <div className="adm-card-foot">
          <button
            type="button"
            className="adm-link"
            aria-disabled={busy ? 'true' : undefined}
            onClick={() => { if (!busy) setConfirmOpen(true); }}
          >
            {busy === 'restore' ? 'Restaurando…' : 'Restaurar anterior'}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={`¿Regresar ${label} a la versión del ${backupWhen || 'respaldo'}?`}
        body={
          info?.backup
            ? `${summaryLine(info.backup)}. La versión publicada actual pasará a ser la anterior.`
            : 'La versión publicada actual pasará a ser la anterior.'
        }
        confirmLabel="Restaurar"
        onConfirm={restore}
        onCancel={() => setConfirmOpen(false)}
      />
    </section>
  );
};

export default DatasetCard;
