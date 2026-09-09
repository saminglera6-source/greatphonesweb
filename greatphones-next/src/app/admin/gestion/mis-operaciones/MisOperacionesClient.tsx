'use client'

import { useCallback, useEffect, useState } from 'react'
import AdminTopbar from '@/components/AdminTopbar'

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 9,
  border: '1.5px solid #E6E7F0',
  borderRadius: 9,
  fontSize: 13,
  background: '#FBFBFD',
  color: '#181B2E',
}
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: '#3D4356',
  marginBottom: 5,
}
function fmtP(n: number) {
  return '$' + (n || 0).toLocaleString('es-AR')
}

interface Op {
  id: string
  source: string
  operationId: string | null
  description: string
  category: string | null
  type: string
  means: string
  amount: number
  amountUsd?: number | null
  opDate: string
  operator: string | null
}

const SOURCES = [
  'SALE',
  'PREORDER',
  'PREVENTA_ENTREGA',
  'COMPRA',
  'REPAIR',
  'GASTO',
  'CAMBIO',
  'AJUSTE',
  'MANUAL',
  'ONLINE',
]
const MEAN_LABEL: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  CUOTAS: 'Cuotas',
  USD: 'USD',
  PAGO_ONLINE: 'Online',
}

export default function MisOperacionesClient() {
  const [rows, setRows] = useState<Op[]>([])
  const [cargando, setCargando] = useState(true)
  const [operador, setOperador] = useState('')
  const [source, setSource] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [fecha, setFecha] = useState('')
  const [msg, setMsg] = useState<{ t: string; s: string } | null>(null)
  const [ver, setVer] = useState<Op | null>(null)
  const [estado, setEstado] = useState<'ACTIVO' | 'ANULADO'>('ACTIVO')

  const toast = (t: string, s: string) => {
    setMsg({ t, s })
    setTimeout(() => setMsg(null), 4000)
  }

  const load = useCallback(async () => {
    setCargando(true)
    const params = new URLSearchParams({ limit: '100', estado })
    if (operador) params.set('operador', operador)
    if (source) params.set('source', source)
    if (busqueda) params.set('busqueda', busqueda)
    if (fecha) params.set('fecha', fecha)
    try {
      const r = await fetch('/api/admin/gestion/mis-operaciones?' + params, {
        credentials: 'include',
      })
      const d = await r.json()
      setRows(d.data || [])
    } catch {
      toast('error', 'Error al cargar')
    }
    setCargando(false)
  }, [operador, source, busqueda, fecha, estado])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const verDetalle = async (id: string) => {
    try {
      const r = await fetch('/api/admin/gestion/mis-operaciones?id=' + id, {
        credentials: 'include',
      })
      const d = await r.json()
      setVer(d)
    } catch {
      toast('error', 'Error al cargar detalle')
    }
  }

  const anular = async (op: Op) => {
    const motivo = prompt('Motivo de la anulación de ' + op.operationId + ':')
    if (motivo === null) return
    if (!motivo.trim()) return toast('error', 'Ingresá un motivo')
    const quien = prompt('¿Quién está anulando?')
    if (!quien) return
    if (!confirm('¿Confirmás anular ' + op.operationId + '?')) return
    const r = await fetch('/api/admin/gestion/mis-operaciones', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operationId: op.operationId, motivo, operador: quien }),
    })
    const d = await r.json()
    if (!r.ok) return toast('error', d.error || 'Error')
    toast('success', `${d.operacion} anulado (${d.asientos} asiento${d.asientos === 1 ? '' : 's'})`)
    load()
  }

  const restaurar = async (op: Op) => {
    const quien = prompt('¿Quién restaura ' + op.operationId + '?')
    if (!quien) return
    if (!confirm('¿Restaurar ' + op.operationId + '? Vuelve a aplicar sus efectos (stock, caja).')) return
    const r = await fetch('/api/admin/gestion/mis-operaciones', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operationId: op.operationId, operador: quien }),
    })
    const d = await r.json()
    if (!r.ok) return toast('error', d.error || 'Error')
    toast('success', `${d.operacion} restaurado`)
    load()
  }

  return (
    <>
      <AdminTopbar titulo="Mis Operaciones" />
      <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
        <style>{`
          .pe-input:focus{ border-color:#FF6B2C!important; outline:none}
          .pe-btn:focus-visible{ outline:2px solid #FF6B2C; outline-offset:2px}
          .pm-card{ animation:pmin .16s ease-out}
          @keyframes pmin{from{opacity:0;transform:translateY(8px) scale(.985)} to{opacity:1;transform:none}}
          @media(prefers-reduced-motion:reduce){.pm-card{animation:none!important}}
        `}</style>

        <p style={{ fontSize: 13, color: '#6B7280', margin: '2px 0 0' }}>
          Movimientos del Libro Diario con filtros por operador, tipo y fecha
        </p>

        {msg && (
          <div
            role={msg.t === 'success' ? 'status' : 'alert'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 16px',
              borderRadius: 10,
              margin: '16px 0',
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

        <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
          {(['ACTIVO', 'ANULADO'] as const).map(e => (
            <button
              key={e}
              onClick={() => setEstado(e)}
              style={{
                padding: '8px 16px',
                borderRadius: 9,
                border: '1px solid ' + (estado === e ? '#4F46E5' : '#E6E7F0'),
                background: estado === e ? '#4F46E5' : '#fff',
                color: estado === e ? '#fff' : '#3D4356',
                fontWeight: 600,
                fontSize: 12.5,
                cursor: 'pointer',
              }}
            >
              {e === 'ACTIVO' ? 'Activas' : 'Anuladas'}
            </button>
          ))}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
            gap: 10,
            marginTop: 10,
            background: '#fff',
            border: '1px solid #E6E7F0',
            borderRadius: 12,
            padding: 16,
          }}
        >
          <div>
            <label htmlFor="mo-op" style={labelStyle}>
              Operador
            </label>
            <select
              id="mo-op"
              className="pe-input"
              style={inputStyle}
              value={operador}
              onChange={e => setOperador(e.target.value)}
            >
              <option value="">Todos</option>
              {['Martin', 'Maca', 'Sam', 'Eva', 'Buda'].map(o => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="mo-tipo" style={labelStyle}>
              Tipo
            </label>
            <select
              id="mo-tipo"
              className="pe-input"
              style={inputStyle}
              value={source}
              onChange={e => setSource(e.target.value)}
            >
              <option value="">Todos</option>
              {SOURCES.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="mo-fecha" style={labelStyle}>
              Fecha
            </label>
            <input
              id="mo-fecha"
              type="date"
              className="pe-input"
              style={inputStyle}
              value={fecha}
              onChange={e => setFecha(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="mo-buscar" style={labelStyle}>
              Buscar N°
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 10px',
                border: '1.5px solid #E6E7F0',
                borderRadius: 9,
                background: '#FBFBFD',
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 16, color: '#94A3B8' }}
                aria-hidden="true"
              >
                search
              </span>
              <input
                id="mo-buscar"
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  padding: '9px 0',
                  fontSize: 13,
                }}
                placeholder="Ej: VTA-004"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
              />
              {busqueda && (
                <button
                  onClick={() => setBusqueda('')}
                  aria-label="Limpiar"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94A3B8',
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
          </div>
        </div>

        <div
          style={{
            overflowX: 'auto',
            marginTop: 16,
            border: '1px solid #E6E7F0',
            borderRadius: 10,
            background: '#fff',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: '#F4F6F9', textAlign: 'left' }}>
                <th style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>Fecha</th>
                <th style={{ padding: '9px 10px' }}>Tipo</th>
                <th style={{ padding: '9px 10px' }}>Número</th>
                <th style={{ padding: '9px 10px' }}>Descripción</th>
                <th style={{ padding: '9px 10px', textAlign: 'right' }}>Importe</th>
                <th style={{ padding: '9px 10px' }}>Operador</th>
                <th style={{ padding: '9px 10px' }}>Medio</th>
                <th style={{ padding: '9px 10px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#8892A6' }}>
                    Cargando operaciones…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#8892A6' }}>
                    Sin operaciones para este filtro.
                  </td>
                </tr>
              ) : (
                rows.map(op => (
                  <tr key={op.id} style={{ borderTop: '1px solid #E6E7F0' }}>
                    <td
                      style={{
                        padding: '8px 10px',
                        whiteSpace: 'nowrap',
                        color: '#6B7280',
                        fontSize: 12,
                      }}
                    >
                      {new Date(op.opDate).toLocaleDateString('es-AR')}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 100,
                          background: '#FAFBFD',
                          border: '1px solid #E6E7F0',
                          color: '#475569',
                        }}
                      >
                        {op.source}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '8px 10px',
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        fontSize: 12,
                      }}
                    >
                      {op.operationId || '—'}
                    </td>
                    <td
                      style={{
                        padding: '8px 10px',
                        maxWidth: 260,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={op.description}
                    >
                      {op.description}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>
                      {fmtP(op.amount)}
                      {op.amountUsd ? ` (US$${op.amountUsd})` : ''}
                    </td>
                    <td style={{ padding: '8px 10px', color: '#6B7280' }}>{op.operator || '—'}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: 100,
                          background: '#EEF0F6',
                          color: '#475569',
                        }}
                      >
                        {MEAN_LABEL[op.means] || op.means}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => verDetalle(op.id)}
                        className="pe-btn"
                        aria-label={`Ver ${op.operationId}`}
                        style={{
                          marginRight: 6,
                          padding: '5px 9px',
                          background: '#fff',
                          color: '#2563EB',
                          border: '1.5px solid #DBEAFE',
                          borderRadius: 7,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
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
                          visibility
                        </span>
                        Ver
                      </button>
                      {estado === 'ACTIVO' ? (
                        <button
                          onClick={() => anular(op)}
                          className="pe-btn"
                          aria-label={`Anular ${op.operationId}`}
                          style={{
                            padding: '5px 9px',
                            background: '#FEF2F2',
                            color: '#DC2626',
                            border: '1.5px solid #FECACA',
                            borderRadius: 7,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 13 }} aria-hidden="true">block</span>
                          Anular
                        </button>
                      ) : (
                        <button
                          onClick={() => restaurar(op)}
                          className="pe-btn"
                          aria-label={`Restaurar ${op.operationId}`}
                          style={{
                            padding: '5px 9px',
                            background: '#ECFDF3',
                            color: '#0F9D58',
                            border: '1.5px solid #A6F4C5',
                            borderRadius: 7,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 13 }} aria-hidden="true">restart_alt</span>
                          Restaurar
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {ver && (
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
              onClick={() => setVer(null)}
              aria-hidden="true"
              style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,.45)' }}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="mo-titulo"
              tabIndex={-1}
              className="pm-card"
              style={{
                position: 'relative',
                zIndex: 1,
                background: '#fff',
                borderRadius: 14,
                padding: 22,
                maxWidth: 520,
                width: '92%',
                maxHeight: '80vh',
                overflowY: 'auto',
                border: '1px solid #E6E7F0',
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
                  marginBottom: 12,
                }}
              >
                <h3
                  id="mo-titulo"
                  style={{ margin: 0, color: '#181B2E', fontSize: 16, fontWeight: 800 }}
                >
                  {ver.source} — {ver.operationId}
                </h3>
                <button
                  onClick={() => setVer(null)}
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
              <dl style={{ fontSize: 13, lineHeight: 1.8, margin: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '6px 0',
                    borderBottom: '1px solid #EEF0F5',
                  }}
                >
                  <dt style={{ color: '#6B7280', margin: 0 }}>Tipo</dt>
                  <dd style={{ fontWeight: 600, margin: 0 }}>{ver.type}</dd>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '6px 0',
                    borderBottom: '1px solid #EEF0F5',
                  }}
                >
                  <dt style={{ color: '#6B7280', margin: 0 }}>Medio</dt>
                  <dd style={{ fontWeight: 600, margin: 0 }}>
                    {MEAN_LABEL[ver.means] || ver.means}
                  </dd>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '6px 0',
                    borderBottom: '1px solid #EEF0F5',
                  }}
                >
                  <dt style={{ color: '#6B7280', margin: 0 }}>Monto</dt>
                  <dd style={{ fontWeight: 800, margin: 0 }}>
                    {fmtP(ver.amount)}
                    {ver.amountUsd ? ` (US$${ver.amountUsd})` : ''}
                  </dd>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '6px 0',
                    borderBottom: '1px solid #EEF0F5',
                  }}
                >
                  <dt style={{ color: '#6B7280', margin: 0 }}>Fecha</dt>
                  <dd style={{ margin: 0 }}>{new Date(ver.opDate).toLocaleString('es-AR')}</dd>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '6px 0',
                    borderBottom: '1px solid #EEF0F5',
                  }}
                >
                  <dt style={{ color: '#6B7280', margin: 0 }}>Operador</dt>
                  <dd style={{ margin: 0 }}>{ver.operator || '—'}</dd>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '6px 0',
                  }}
                >
                  <dt style={{ color: '#6B7280', margin: 0 }}>Categoría</dt>
                  <dd style={{ margin: 0 }}>{ver.category || '—'}</dd>
                </div>
              </dl>
              <div
                style={{
                  marginTop: 12,
                  background: '#FAFBFD',
                  border: '1px solid #EDF0F6',
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', marginBottom: 4 }}>
                  Descripción
                </div>
                <p style={{ fontSize: 13, color: '#181B2E', margin: 0, whiteSpace: 'pre-wrap' }}>
                  {ver.description}
                </p>
              </div>
              <button
                onClick={() => setVer(null)}
                className="pe-btn"
                style={{
                  marginTop: 16,
                  padding: '9px 16px',
                  background: '#EEF0F6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: 9,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
