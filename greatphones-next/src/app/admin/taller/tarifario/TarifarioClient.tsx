'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import AdminTopbar from '@/components/AdminTopbar'
import { fmtARS } from '@/lib/precios'

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 9,
  border: '1.5px solid #E6E7F0',
  borderRadius: 9,
  fontSize: 13,
  background: '#FBFBFD',
  color: '#181B2E',
}
const inputErrorStyle: React.CSSProperties = { borderColor: '#DC2626', background: '#FEF6F6' }

interface TarifarioRow {
  modelo: string
  trabajos: Array<{
    nombre: string
    precio: number | null
    sinConfigurar?: boolean
    motivo?: string
  }>
}
interface ConfigRow {
  key: string
  multiplicador: number
  horas: number
  activo: boolean
}

const LABELS: Record<string, string> = {
  bateria: 'Batería',
  pantalla: 'Pantalla',
  camara: 'Cámara',
  microfono: 'Micrófono',
  parlante: 'Parlante',
  tapa: 'Tapa trasera',
  marco: 'Marco',
  pin: 'Pin de carga',
  flex: 'Flex de carga',
  botones: 'Botones laterales',
  chasis: 'Chasis',
}

export default function TarifarioClient() {
  const [tab, setTab] = useState<'ver' | 'config' | 'icare'>('ver')
  const [icareCsv, setIcareCsv] = useState('')
  const [icareCount, setIcareCount] = useState<number | null>(null)
  const [icareMsg, setIcareMsg] = useState<string | null>(null)
  const [icareBusy, setIcareBusy] = useState(false)

  useEffect(() => {
    fetch('/api/admin/taller/icare', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setIcareCount(d.count ?? 0))
      .catch(() => {})
  }, [])

  const importarIcare = async (confirmar = false) => {
    setIcareMsg(null)
    setIcareBusy(true)
    try {
      const r = await fetch('/api/admin/taller/icare', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: icareCsv, confirmar }),
      })
      const d = await r.json()
      if (r.status === 409 && d.needsConfirm) {
        if (confirm(d.error)) return importarIcare(true)
        return
      }
      if (!r.ok) {
        setIcareMsg(d.error || 'Error al importar')
        return
      }
      setIcareMsg(`Tarifario Icare importado: ${d.importadas} filas${d.descartadas ? ` · ${d.descartadas} descartadas` : ''}`)
      setIcareCount(d.importadas)
      setIcareCsv('')
    } finally {
      setIcareBusy(false)
    }
  }
  const [rows, setRows] = useState<TarifarioRow[]>([])
  const [configs, setConfigs] = useState<ConfigRow[]>([])
  const [buscar, setBuscar] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState<string | null>(null)
  const [editando, setEditando] = useState<ConfigRow | null>(null)
  const [draft, setDraft] = useState({ multiplicador: 1, horas: 48, activo: true })
  const [msg, setMsg] = useState<{ t: string; s: string } | null>(null)
  const [toastVista, setToastVista] = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  const toast = (t: string, s: string) => {
    setMsg({ t, s })
    setTimeout(() => setMsg(null), 4000)
  }

  const load = useCallback(async () => {
    setCargando(true)
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/admin/taller', { credentials: 'include' }),
        fetch('/api/admin/taller/config', { credentials: 'include' }),
      ])
      const d1 = await r1.json()
      const d2 = await r2.json()
      setRows(Array.isArray(d1) ? d1 : [])
      setConfigs(Array.isArray(d2) ? d2 : [])
    } catch {
      toast('error', 'Error al cargar')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const filtrados = rows.filter(
    r => !buscar || r.modelo.toLowerCase().includes(buscar.toLowerCase()),
  )

  const abrirEditar = (c: ConfigRow) => {
    setEditando(c)
    setDraft({ multiplicador: c.multiplicador, horas: c.horas, activo: c.activo })
  }

  const cerrarModal = () => setEditando(null)

  const guardarConfig = async () => {
    if (!editando) return
    setGuardando(editando.key)
    try {
      const r = await fetch('/api/admin/taller/config', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: editando.key,
          multiplicador: Number(draft.multiplicador) || 1,
          horas: Number(draft.horas) || 48,
          activo: draft.activo,
        }),
      })
      if (!r.ok) {
        const d = await r.json()
        toast('error', d.error || 'Error')
        return
      }
      setConfigs(cs => cs.map(x => (x.key === editando.key ? { ...x, ...draft } : x)))
      toast('success', `${LABELS[editando.key] || editando.key} actualizado`)
      setEditando(null)
      load()
    } catch {
      toast('error', 'Error de conexión')
    } finally {
      setGuardando(null)
    }
  }

  const copiarFila = async (r: TarifarioRow) => {
    const texto =
      r.modelo +
      '\n' +
      r.trabajos
        .map(t => `${t.nombre}: ${t.precio != null ? fmtARS(t.precio) : 'sin configurar'}`)
        .join('\n')
    try {
      await navigator.clipboard.writeText(texto)
      setToastVista('Tarifario copiado')
      setTimeout(() => setToastVista(null), 2000)
    } catch {}
  }

  const LABEL_TO_KEY: Record<string, string> = Object.fromEntries(
    Object.entries(LABELS).map(([k, v]) => [v, k]),
  )

  const editarCategoria = (nombre: string) => {
    const key = LABEL_TO_KEY[nombre] || ''
    const cfg = configs.find(c => c.key === key)
    if (!cfg) return
    abrirEditar(cfg)
  }

  return (
    <>
      <AdminTopbar titulo="Tarifario de Reparaciones" />
      <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
        <style>{`
          .tf-search:focus-within{border-color:#FF6B2C!important}
          .tf-search input:focus{outline:none}
          .tf-tab{ background:none; border:none; padding:10px 4px; cursor:pointer; display:inline-flex; align-items:center; gap:7px; font-size:14; transition:color .15s}
          .tf-tab:focus-visible{outline:2px solid #FF6B2C;outline-offset:2px;border-radius:6px}
          .tf-card{transition:box-shadow .15s}
          .tf-card:hover{box-shadow:0 4px 16px rgba(23,23,45,.08)}
          .pe-input:focus{border-color:#FF6B2C!important;outline:none}
          .pe-btn:focus-visible{outline:2px solid #FF6B2C;outline-offset:2px}
          .pm-card{animation:pmin .16s ease-out}
          @keyframes pmin{from{opacity:0;transform:translateY(8px) scale(.985)} to{opacity:1;transform:none}}
          .pe-spin{animation:pes 1s linear infinite}
          @keyframes pes{to{transform:rotate(360deg)}}
          @media(prefers-reduced-motion:reduce){.pm-card{animation:none!important} .pe-spin{animation:none!important}}
        `}</style>

        <p style={{ fontSize: 13, color: '#6B7280', margin: '2px 0 0' }}>
          Calculado desde Toma de Equipos × multiplicador de la configuración
        </p>

        <div
          style={{ display: 'flex', gap: 24, margin: '16px 0', borderBottom: '1px solid #E6E7F0' }}
          role="tablist"
          aria-label="Secciones del tarifario"
        >
          {(
            [
              ['ver', 'Ver tarifario', 'visibility'],
              ['config', 'Configuración', 'settings'],
              ['icare', 'Tarifario Icare', 'cloud_upload'],
            ] as const
          ).map(([k, label, icon]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className="tf-tab"
              style={{
                fontWeight: tab === k ? 700 : 500,
                color: tab === k ? '#FF6B2C' : '#64748B',
                borderBottom: tab === k ? '2px solid #FF6B2C' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 17 }}
                aria-hidden="true"
              >
                {icon}
              </span>
              {label}
            </button>
          ))}
        </div>

        {msg && (
          <div
            role={msg.t === 'success' ? 'status' : 'alert'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              borderRadius: 10,
              marginBottom: 14,
              color: '#fff',
              fontWeight: 600,
              fontSize: 13,
              background: msg.t === 'success' ? '#0F9D58' : '#DC2626',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }} aria-hidden="true">
              {msg.t === 'success' ? 'check_circle' : 'error'}
            </span>
            {msg.s}
          </div>
        )}

        {tab === 'icare' ? (
          <div style={{ maxWidth: 640 }}>
            <p style={{ fontSize: 13, color: '#3D4356', margin: '0 0 6px' }}>
              Pegá el tarifario del proveedor (una fila por línea):{' '}
              <code style={{ background: '#F1F3F7', padding: '1px 5px', borderRadius: 4 }}>modelo, categoria, precioGuia</code>
            </p>
            <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 10px' }}>
              Categorías válidas: bateria, pantalla, camara, microfono, parlante, tapa, marco, pin, flex, botones, chasis.
              El Precio Público se calcula automáticamente (Precio Guía × 1,20). Importar reemplaza TODO el tarifario.
              {icareCount != null && <> · Hoy hay <strong>{icareCount}</strong> filas cargadas.</>}
            </p>
            <textarea
              value={icareCsv}
              onChange={e => setIcareCsv(e.target.value)}
              placeholder={'iPhone 13, pantalla, 45000\niPhone 13, bateria, 18000\niPhone 12, pantalla, 38000'}
              style={{ width: '100%', minHeight: 200, padding: 12, border: '1.5px solid #E6E7F0', borderRadius: 9, fontSize: 12.5, fontFamily: 'monospace', background: '#FBFBFD' }}
            />
            {icareMsg && <p style={{ fontSize: 13, color: '#166534', margin: '8px 0 0' }}>{icareMsg}</p>}
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button onClick={() => importarIcare(false)} disabled={icareBusy || !icareCsv.trim()} style={{ background: 'linear-gradient(135deg,#4F46E5,#6366F1)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                {icareBusy ? 'Importando…' : 'Importar tarifario'}
              </button>
              {icareCount ? (
                <button onClick={async () => { if (confirm('¿Vaciar el tarifario Icare?')) { await fetch('/api/admin/taller/icare', { method: 'DELETE', credentials: 'include' }); setIcareCount(0); setIcareMsg('Tarifario vaciado') } }} style={{ background: '#fff', color: '#DC2626', border: '1.5px solid #FECACA', padding: '10px 16px', borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  Vaciar
                </button>
              ) : null}
            </div>
          </div>
        ) : tab === 'ver' ? (
          <>
            <div
              className="tf-search"
              style={{
                maxWidth: 340,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '0 10px',
                border: '1.5px solid #E6E7F0',
                borderRadius: 9,
                background: '#FBFBFD',
                marginBottom: 14,
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 18, color: '#94A3B8' }}
                aria-hidden="true"
              >
                search
              </span>
              <input
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  padding: '9px 0',
                  fontSize: 13,
                  color: '#181B2E',
                }}
                placeholder="Buscar modelo..."
                value={buscar}
                onChange={e => setBuscar(e.target.value)}
                aria-label="Buscar modelo"
              />
              {buscar && (
                <button
                  onClick={() => setBuscar('')}
                  aria-label="Limpiar búsqueda"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94A3B8',
                    padding: 0,
                    display: 'flex',
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 16 }}
                    aria-hidden="true"
                  >
                    close
                  </span>
                </button>
              )}
            </div>

            {toastVista && (
              <div
                role="status"
                style={{
                  position: 'fixed',
                  bottom: 24,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 60,
                  background: '#181B2E',
                  color: '#fff',
                  padding: '10px 18px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  boxShadow: '0 8px 24px rgba(23,23,45,.25)',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 16, color: '#4ADE80' }}
                    aria-hidden="true"
                  >
                    check_circle
                  </span>
                  {toastVista}
                </span>
              </div>
            )}

            {cargando ? (
              <p style={{ textAlign: 'center', color: '#8892A6', padding: 32, fontSize: 13 }}>
                Cargando tarifario…
              </p>
            ) : filtrados.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#8892A6', padding: 32 }}>
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 34, color: '#C3C9D6' }}
                  aria-hidden="true"
                >
                  search_off
                </span>
                <p style={{ margin: '6px 0 0', fontSize: 13 }}>
                  {buscar ? 'Sin resultados para tu búsqueda.' : 'No hay modelos con tarifario.'}
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))',
                  gap: 14,
                }}
              >
                {filtrados.map(r => (
                  <div
                    key={r.modelo}
                    className="tf-card"
                    style={{
                      background: '#fff',
                      border: '1px solid #E6E7F0',
                      borderRadius: 12,
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontWeight: 700,
                          fontSize: 13.5,
                          color: '#181B2E',
                        }}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: 15, color: '#FF6B2C' }}
                          aria-hidden="true"
                        >
                          smartphone
                        </span>
                        {r.modelo}
                      </span>
                      <button
                        onClick={() => copiarFila(r)}
                        className="pe-btn"
                        aria-label={`Copiar tarifario de ${r.modelo}`}
                        title="Copiar"
                        style={{
                          background: '#EEF0F6',
                          color: '#64748B',
                          border: 'none',
                          borderRadius: 7,
                          padding: 5,
                          cursor: 'pointer',
                          display: 'inline-flex',
                        }}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: 14 }}
                          aria-hidden="true"
                        >
                          content_copy
                        </span>
                      </button>
                    </div>
                    <div style={{ display: 'grid', gap: 4, flex: 1 }}>
                      {r.trabajos.map((t, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: 12.5,
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <span style={{ color: '#6B7280' }}>{t.nombre}</span>
                          {t.precio != null ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <b style={{ color: '#181B2E' }}>{fmtARS(t.precio)}</b>
                              <button
                                onClick={() => editarCategoria(t.nombre)}
                                className="pe-btn"
                                aria-label={`Editar precio de ${t.nombre}`}
                                title={`Editar ${t.nombre}`}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#94A3B8',
                                  cursor: 'pointer',
                                  padding: 1,
                                  display: 'inline-flex',
                                }}
                              >
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: 13 }}
                                  aria-hidden="true"
                                >
                                  edit
                                </span>
                              </button>
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ color: '#B7950B', fontWeight: 600 }}>sin configurar</span>
                              <button
                                onClick={() => editarCategoria(t.nombre)}
                                className="pe-btn"
                                aria-label={`Configurar ${t.nombre}`}
                                title={`Configurar ${t.nombre}`}
                                style={{
                                  background: '#FEF3C7',
                                  border: '1px solid #FCD34D',
                                  color: '#B7950B',
                                  cursor: 'pointer',
                                  padding: '4px 8px',
                                  borderRadius: 5,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: 13 }}
                                  aria-hidden="true"
                                >
                                  add_circle
                                </span>
                                Configurar
                              </button>
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <p style={{ fontSize: 12.5, color: '#6B7280', margin: '0 0 12px' }}>
              Ajustá el multiplicador y las horas estimadas de cada tipo de trabajo. Los cambios
              recalculan el tarifario automáticamente.
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))',
                gap: 12,
              }}
            >
              {configs.map(c => (
                <div
                  key={c.key}
                  className="tf-card"
                  style={{
                    background: '#fff',
                    border: '1px solid #E6E7F0',
                    borderRadius: 12,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: 13.5, color: '#181B2E' }}>
                      {LABELS[c.key] || c.key}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 99,
                        background: c.activo ? '#D5F5E3' : '#FEE',
                        color: c.activo ? '#166534' : '#991B1B',
                      }}
                    >
                      {c.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 10,
                      fontSize: 12,
                    }}
                  >
                    <div>
                      <span style={{ color: '#6B7280' }}>Multiplicador</span>
                      <br />
                      <b style={{ fontSize: 15 }}>×{c.multiplicador}</b>
                    </div>
                    <div>
                      <span style={{ color: '#6B7280' }}>Horas</span>
                      <br />
                      <b style={{ fontSize: 15 }}>{c.horas}h</b>
                    </div>
                  </div>
                  <button
                    onClick={() => abrirEditar(c)}
                    className="pe-btn"
                    style={{
                      marginTop: 'auto',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      background: '#fff',
                      color: '#2563EB',
                      border: '1.5px solid #DBEAFE',
                      padding: '8px 12px',
                      borderRadius: 9,
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 15 }}
                      aria-hidden="true"
                    >
                      edit
                    </span>{' '}
                    Editar
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {editando && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 120,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
          >
            <div
              onClick={cerrarModal}
              aria-hidden="true"
              style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,.45)' }}
            />
            <div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="tf-titulo"
              tabIndex={-1}
              className="pm-card"
              style={{
                position: 'relative',
                zIndex: 1,
                width: 'min(92vw, 440px)',
                background: '#fff',
                border: '1px solid #E6E7F0',
                borderRadius: 14,
                padding: 22,
                boxShadow: '0 12px 48px rgba(23,23,45,.22)',
                outline: 'none',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 4,
                }}
              >
                <h2
                  id="tf-titulo"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 16,
                    fontWeight: 800,
                    color: '#181B2E',
                    margin: 0,
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 19, color: '#FF6B2C' }}
                    aria-hidden="true"
                  >
                    settings
                  </span>
                  {LABELS[editando.key] || editando.key}
                </h2>
                <button
                  onClick={cerrarModal}
                  className="pe-btn"
                  aria-label="Cerrar"
                  style={{
                    background: '#EEF0F6',
                    color: '#64748B',
                    border: 'none',
                    borderRadius: 8,
                    padding: 6,
                    cursor: 'pointer',
                    display: 'inline-flex',
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 17 }}
                    aria-hidden="true"
                  >
                    close
                  </span>
                </button>
              </div>
              <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 14px' }}>
                Precio de reparación = valor de toma × multiplicador
              </p>

              <label
                htmlFor="tf-mult"
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#3D4356',
                  marginBottom: 4,
                }}
              >
                Multiplicador
              </label>
              <input
                id="tf-mult"
                type="number"
                step="0.1"
                min={0}
                className="pe-input"
                style={{
                  ...inputStyle,
                  ...(String(draft.multiplicador) === '' ? inputErrorStyle : {}),
                }}
                value={String(draft.multiplicador)}
                onChange={e =>
                  setDraft(d => ({ ...d, multiplicador: Number(e.target.value) || 0 }))
                }
                onFocus={e => e.currentTarget.select()}
              />

              <label
                htmlFor="tf-horas"
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#3D4356',
                  marginTop: 12,
                  marginBottom: 4,
                }}
              >
                Horas estimadas
              </label>
              <input
                id="tf-horas"
                type="number"
                min={0}
                className="pe-input"
                style={inputStyle}
                value={String(draft.horas)}
                onChange={e => setDraft(d => ({ ...d, horas: Number(e.target.value) || 0 }))}
                onFocus={e => e.currentTarget.select()}
              />

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 14,
                  fontSize: 13,
                  color: '#3D4356',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={draft.activo}
                  onChange={e => setDraft(d => ({ ...d, activo: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: '#FF6B2C' }}
                />{' '}
                Activo (aparece en el tarifario)
              </label>

              <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
                <button
                  onClick={cerrarModal}
                  className="pe-btn"
                  style={{
                    background: '#EEF0F6',
                    color: '#374151',
                    padding: '9px 18px',
                    border: 'none',
                    borderRadius: 9,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={guardarConfig}
                  disabled={!!guardando}
                  className="pe-btn"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    background: guardando ? '#7FD3A8' : '#0F9D58',
                    color: '#fff',
                    padding: '9px 20px',
                    border: 'none',
                    borderRadius: 9,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: guardando ? 'wait' : 'pointer',
                  }}
                >
                  {guardando ? (
                    <>
                      <span
                        className="material-symbols-outlined pe-spin"
                        style={{ fontSize: 15 }}
                        aria-hidden="true"
                      >
                        progress_activity
                      </span>
                      Guardando…
                    </>
                  ) : (
                    <>
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: 15 }}
                        aria-hidden="true"
                      >
                        save
                      </span>
                      Guardar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
