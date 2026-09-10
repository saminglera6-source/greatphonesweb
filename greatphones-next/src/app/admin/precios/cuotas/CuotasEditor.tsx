'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import AdminTopbar from '@/components/AdminTopbar'

interface CuotaRow {
  id: string
  cuotas: number
  coeficiente: number
  activo: boolean
  mostrar: boolean
  observacion?: string | null
  orden: number
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 9,
  border: '1.5px solid #E6E7F0',
  borderRadius: 9,
  fontSize: 13,
  background: '#FBFBFD',
  color: '#181B2E',
  transition: 'border-color .15s',
}
const inputErrorStyle: React.CSSProperties = { borderColor: '#DC2626', background: '#FEF6F6' }
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: '#3D4356',
  marginBottom: 4,
}

export default function CuotasEditor() {
  const [rows, setRows] = useState<CuotaRow[]>([])
  const [cargando, setCargando] = useState(true)
  const [buscar, setBuscar] = useState('')
  const [msg, setMsg] = useState<{ t: string; s: string } | null>(null)
  const [modal, setModal] = useState<{
    modo: 'nuevo' | 'editar'
    valores: Partial<CuotaRow> & { cuotas: number; coeficiente: number }
  } | null>(null)
  const [errorCuotas, setErrorCuotas] = useState('')
  const [guardando, setGuardando] = useState(false)
  const cuotasRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const disparadorRef = useRef<HTMLElement | null>(null)

  const toast = useCallback((t: string, s: string) => {
    setMsg({ t, s })
    setTimeout(() => setMsg(null), 4000)
  }, [])

  const load = useCallback(async () => {
    setCargando(true)
    try {
      const r = await fetch('/api/admin/precios/cuotas', { credentials: 'include' })
      const d = await r.json()
      setRows(Array.isArray(d) ? d : [])
    } catch {
      toast('error', 'Error al cargar cuotas')
    }
    setCargando(false)
  }, [toast])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const filtrados = rows.filter(
    r =>
      !buscar ||
      String(r.cuotas).includes(buscar) ||
      (r.observacion || '').toLowerCase().includes(buscar.toLowerCase()),
  )

  const abrirNuevo = () => {
    disparadorRef.current = document.activeElement as HTMLElement
    setErrorCuotas('')
    setModal({
      modo: 'nuevo',
      valores: {
        cuotas: 1,
        coeficiente: 1,
        activo: true,
        mostrar: true,
        observacion: '',
        orden: rows.length,
      },
    })
  }
  const abrirEditar = (r: CuotaRow) => {
    disparadorRef.current = document.activeElement as HTMLElement
    setErrorCuotas('')
    setModal({ modo: 'editar', valores: { ...r } })
  }
  const cerrarModal = useCallback(() => {
    setModal(null)
    setErrorCuotas('')
    requestAnimationFrame(() => disparadorRef.current?.focus())
  }, [])

  const modalAbierto = !!modal

  useEffect(() => {
    if (!modalAbierto) return
    document.body.style.overflow = 'hidden'
    const t = requestAnimationFrame(() => cuotasRef.current?.focus())
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.preventDefault()
        cerrarModal()
        return
      }
      if (ev.key === 'Tab' && modalRef.current) {
        const focuseables = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        if (focuseables.length === 0) return
        const primero = focuseables[0]
        const ultimo = focuseables[focuseables.length - 1]
        if (!ev.shiftKey && document.activeElement === ultimo) {
          ev.preventDefault()
          primero.focus()
        } else if (
          ev.shiftKey &&
          (document.activeElement === primero || document.activeElement === modalRef.current)
        ) {
          ev.preventDefault()
          ultimo.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = ''
      cancelAnimationFrame(t)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [modalAbierto, cerrarModal])

  const guardar = async () => {
    if (!modal) return
    const v = modal.valores
    if (!v.cuotas || v.cuotas < 1) {
      setErrorCuotas('Las cuotas deben ser >= 1')
      cuotasRef.current?.focus()
      return
    }
    if (!v.coeficiente || v.coeficiente <= 0) {
      toast('error', 'El coeficiente debe ser > 0')
      return
    }
    setGuardando(true)
    try {
      const payload = {
        id: (v as CuotaRow).id,
        cuotas: Number(v.cuotas),
        coeficiente: Number(v.coeficiente),
        activo: Boolean(v.activo),
        mostrar: Boolean(v.mostrar),
        observacion: v.observacion || null,
        orden: Number(v.orden) || 0,
      }
      const method = modal.modo === 'nuevo' ? 'POST' : 'PATCH'
      const r = await fetch('/api/admin/precios/cuotas', {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await r.json()
      if (!r.ok) {
        toast('error', d.error || 'Error')
        return
      }
      toast('success', modal.modo === 'nuevo' ? 'Cuota creada' : 'Cuota actualizada')
      setModal(null)
      load()
    } catch {
      toast('error', 'Error de conexión')
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (id: string) => {
    const motivo = prompt('Motivo de la baja de este plan de cuotas:')?.trim()
    if (!motivo) return
    const r = await fetch(`/api/admin/precios/cuotas?id=${id}&motivo=${encodeURIComponent(motivo)}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!r.ok) {
      const d = await r.json()
      return toast('error', d.error || 'Error')
    }
    toast('success', 'Eliminado')
    load()
  }

  const campoNumero = (
    key: 'cuotas' | 'coeficiente' | 'orden',
    label: string,
    requerido = false,
    refEl?: React.RefObject<HTMLInputElement | null>,
  ) => {
    if (!modal) return null
    const err = key === 'cuotas' ? errorCuotas : ''
    const val = modal.valores[key]
    return (
      <div>
        <label htmlFor={`cu-${key}`} style={labelStyle}>
          {label}
          {requerido ? ' *' : ''}
        </label>
        <input
          ref={refEl as React.RefObject<HTMLInputElement>}
          id={`cu-${key}`}
          type="number"
          min={key === 'cuotas' ? 1 : 0}
          step={key === 'coeficiente' ? 0.01 : 1}
          className="pe-input"
          style={{ ...inputStyle, ...(err ? inputErrorStyle : {}) }}
          value={String(val ?? '')}
          aria-invalid={err ? true : undefined}
          aria-describedby={err ? `cu-${key}-error` : undefined}
          onChange={e =>
            setModal({
              ...modal,
              valores: {
                ...modal.valores,
                [key]: e.target.value === '' ? ('' as unknown as number) : Number(e.target.value),
              },
            })
          }
          onBlur={
            key === 'cuotas'
              ? () => {
                  if (!modal.valores.cuotas || Number(modal.valores.cuotas) < 1)
                    setErrorCuotas('Las cuotas deben ser >= 1')
                  else setErrorCuotas('')
                }
              : undefined
          }
        />
        {err && (
          <p
            id={`cu-${key}-error`}
            role="alert"
            style={{ fontSize: 11.5, color: '#DC2626', margin: '4px 0 0' }}
          >
            {err}
          </p>
        )}
      </div>
    )
  }

  return (
    <>
      <AdminTopbar titulo="Cuotas" />
      <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
        <style>{`
          .pe-input:focus{ border-color:#FF6B2C!important; outline:none}
          .pe-btn:focus-visible{ outline:2px solid #FF6B2C; outline-offset:2px}
          .pm-card{ animation:pmin .16s ease-out}
          @keyframes pmin{from{opacity:0;transform:translateY(8px) scale(.985)} to{opacity:1;transform:none}}
          .pe-spin{ animation:pes 1s linear infinite}
          @keyframes pes{to{transform:rotate(360deg)}}
          @media(prefers-reduced-motion:reduce){.pm-card{animation:none!important} .pe-spin{animation:none!important}}
        `}</style>

        <p style={{ fontSize: 13, color: '#6B7280', margin: '2px 0 0' }}>
          Configurá cuotas, coeficiente y visibilidad para la calculadora
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
              margin: '14px 0',
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

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            marginTop: 16,
            flexWrap: 'wrap',
          }}
        >
          <input
            className="pe-input"
            style={{ ...inputStyle, maxWidth: 320 }}
            placeholder="Buscar por cuotas u observación..."
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
            aria-label="Buscar cuota"
          />
          <button
            onClick={abrirNuevo}
            className="pe-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              background: 'linear-gradient(135deg,#FF6B2C,#FF8A50)',
              color: '#fff',
              border: 'none',
              padding: '10px 18px',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 17 }} aria-hidden="true">
              add
            </span>
            Nueva cuota
          </button>
        </div>

        <div
          style={{
            overflowX: 'auto',
            marginTop: 14,
            border: '1px solid #E6E7F0',
            borderRadius: 10,
            background: '#fff',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F4F6F9', textAlign: 'left' }}>
                <th style={{ padding: '9px 10px' }}>Cuotas</th>
                <th style={{ padding: '9px 10px' }}>Coeficiente</th>
                <th style={{ padding: '9px 10px' }}>Activo</th>
                <th style={{ padding: '9px 10px' }}>Mostrar</th>
                <th style={{ padding: '9px 10px' }}>Observación</th>
                <th style={{ padding: '9px 10px' }}>Orden</th>
                <th style={{ padding: '9px 10px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#8892A6' }}>
                    Cargando cuotas…
                  </td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#8892A6' }}>
                    Sin cuotas configuradas.
                  </td>
                </tr>
              ) : (
                filtrados.map(r => (
                  <tr key={r.id} style={{ borderTop: '1px solid #E6E7F0' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 700 }}>{r.cuotas}</td>
                    <td style={{ padding: '8px 10px' }}>{r.coeficiente}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 99,
                          background: r.activo ? '#D5F5E3' : '#FEE',
                          color: r.activo ? '#166534' : '#991B1B',
                          border: `1px solid ${r.activo ? '#ABEBC6' : '#FECACA'}`,
                        }}
                      >
                        {r.activo ? 'Sí' : 'No'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 99,
                          background: r.mostrar ? '#D5F5E3' : '#FEE',
                          color: r.mostrar ? '#166534' : '#991B1B',
                          border: `1px solid ${r.mostrar ? '#ABEBC6' : '#FECACA'}`,
                        }}
                      >
                        {r.mostrar ? 'Sí' : 'No'}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '8px 10px',
                        color: '#6B7280',
                        maxWidth: 200,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={r.observacion || ''}
                    >
                      {r.observacion || '—'}
                    </td>
                    <td style={{ padding: '8px 10px' }}>{r.orden}</td>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => abrirEditar(r)}
                        className="pe-btn"
                        aria-label={`Editar ${r.cuotas} cuotas`}
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
                          edit
                        </span>
                        Editar
                      </button>
                      <button
                        onClick={() => eliminar(r.id)}
                        className="pe-btn"
                        aria-label={`Eliminar ${r.cuotas} cuotas`}
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
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: 13 }}
                          aria-hidden="true"
                        >
                          delete
                        </span>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {modal && (
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
              aria-labelledby="cu-titulo"
              tabIndex={-1}
              className="pm-card"
              style={{
                position: 'relative',
                zIndex: 1,
                width: 'min(92vw, 520px)',
                background: '#fff',
                border: '1px solid #E6E7F0',
                borderRadius: 14,
                padding: 22,
                boxShadow: '0 12px 48px rgba(23,23,45,.22)',
                outline: 'none',
                maxHeight: '90vh',
                overflowY: 'auto',
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
                  id="cu-titulo"
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
                    {modal.modo === 'nuevo' ? 'add_circle' : 'edit'}
                  </span>
                  {modal.modo === 'nuevo' ? 'Nueva cuota' : 'Editar cuota'}
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

              <div
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}
              >
                {campoNumero('cuotas', 'Cuotas', true, cuotasRef)}
                {campoNumero('coeficiente', 'Coeficiente', true)}
                {campoNumero('orden', 'Orden')}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="cu-observacion" style={labelStyle}>
                    Observación
                  </label>
                  <input
                    id="cu-observacion"
                    className="pe-input"
                    style={inputStyle}
                    value={modal.valores.observacion || ''}
                    onChange={e =>
                      setModal({
                        ...modal,
                        valores: { ...modal.valores, observacion: e.target.value },
                      })
                    }
                    placeholder="Ej: 3 sin interés"
                  />
                </div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 13,
                    color: '#3D4356',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(modal.valores.activo)}
                    onChange={e =>
                      setModal({
                        ...modal,
                        valores: { ...modal.valores, activo: e.target.checked },
                      })
                    }
                    style={{ width: 16, height: 16, accentColor: '#FF6B2C' }}
                  />
                  Activo
                </label>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 13,
                    color: '#3D4356',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(modal.valores.mostrar)}
                    onChange={e =>
                      setModal({
                        ...modal,
                        valores: { ...modal.valores, mostrar: e.target.checked },
                      })
                    }
                    style={{ width: 16, height: 16, accentColor: '#FF6B2C' }}
                  />
                  Mostrar en calculadora
                </label>
              </div>

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
                  onClick={guardar}
                  disabled={guardando}
                  className="pe-btn"
                  style={{
                    background: guardando ? '#FFB48C' : 'linear-gradient(135deg,#FF6B2C,#FF8A50)',
                    color: '#fff',
                    border: 'none',
                    padding: '9px 20px',
                    borderRadius: 9,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: guardando ? 'wait' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {guardando ? (
                    <>
                      <span
                        className="material-symbols-outlined"
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
                        check
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
