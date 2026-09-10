'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { fmtARS } from '@/lib/precios'

interface TomaRow {
  id: string
  modelo: string
  impecable: number
  bateria: number
  pantalla: number
  camara: number
  microfono: number
  parlante: number
  tapa: number
  marco: number
  pin: number
}

type TomaValores = Omit<TomaRow, 'id'>

const VACIO: TomaValores = {
  modelo: '',
  impecable: 0,
  bateria: 0,
  pantalla: 0,
  camara: 0,
  microfono: 0,
  parlante: 0,
  tapa: 0,
  marco: 0,
  pin: 0,
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

const CAMPOS: Array<{ key: keyof Omit<TomaValores, 'modelo'>; label: string }> = [
  { key: 'impecable', label: 'Precio impecable ($)' },
  { key: 'bateria', label: 'Batería ($)' },
  { key: 'pantalla', label: 'Pantalla ($)' },
  { key: 'camara', label: 'Cámara ($)' },
  { key: 'microfono', label: 'Micrófono ($)' },
  { key: 'parlante', label: 'Parlante ($)' },
  { key: 'tapa', label: 'Tapa trasera ($)' },
  { key: 'marco', label: 'Marco ($)' },
  { key: 'pin', label: 'Pin de carga ($)' },
]

export default function TomaEditor() {
  const [rows, setRows] = useState<TomaRow[]>([])
  const [cargando, setCargando] = useState(true)
  const [buscar, setBuscar] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorModelo, setErrorModelo] = useState('')
  const [msg, setMsg] = useState<{ t: string; s: string } | null>(null)
  const [modal, setModal] = useState<{
    modo: 'nuevo' | 'editar'
    valores: TomaValores & { id?: string }
  } | null>(null)
  const modeloRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const disparadorRef = useRef<HTMLElement | null>(null)

  const toast = useCallback((t: string, s: string) => {
    setMsg({ t, s })
    setTimeout(() => setMsg(null), 4000)
  }, [])

  useEffect(() => {
    let activo = true
    fetch('/api/admin/precios/toma', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (activo) {
          setRows(Array.isArray(d) ? d : [])
          setCargando(false)
        }
      })
      .catch(() => {
        if (activo) {
          setCargando(false)
          toast('error', 'Error al cargar')
        }
      })
    return () => {
      activo = false
    }
  }, [toast])

  const filtrados = rows.filter(
    r => !buscar || (r.modelo || '').toLowerCase().includes(buscar.toLowerCase()),
  )

  const abrirNuevo = () => {
    disparadorRef.current = document.activeElement as HTMLElement
    setErrorModelo('')
    setModal({ modo: 'nuevo', valores: { ...VACIO } })
  }

  const abrirEditar = (r: TomaRow) => {
    disparadorRef.current = document.activeElement as HTMLElement
    setErrorModelo('')
    const { id, ...valores } = r
    setModal({ modo: 'editar', valores: { ...valores, id } })
  }

  const cerrarModal = useCallback(() => {
    setModal(null)
    setErrorModelo('')
    requestAnimationFrame(() => disparadorRef.current?.focus())
  }, [])

  const modalAbierto = !!modal

  useEffect(() => {
    if (!modalAbierto) return
    document.body.style.overflow = 'hidden'
    const t = requestAnimationFrame(() => modeloRef.current?.focus())
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
    const esNuevo = modal.modo === 'nuevo'
    if (!modal.valores.modelo.trim()) {
      setErrorModelo('El modelo es obligatorio')
      modeloRef.current?.focus()
      return
    }
    setGuardando(true)
    try {
      const payload: TomaValores = { ...modal.valores, modelo: modal.valores.modelo.trim() }
      const method = esNuevo ? 'POST' : 'PATCH'
      const body = esNuevo ? payload : { id: modal.valores.id, ...payload }
      const r = await fetch('/api/admin/precios/toma', {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await r.json()
      if (!r.ok) {
        toast('error', d.error || 'Error')
        return
      }
      toast('success', esNuevo ? 'Modelo creado' : 'Modelo actualizado')
      setRows(prev =>
        esNuevo
          ? [...prev, d]
          : prev.map(x => (x.id === modal.valores.id ? { ...x, ...payload } : x)),
      )
      setModal(null)
    } catch {
      toast('error', 'Error de conexión')
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (id: string) => {
    const motivo = prompt('Motivo de la baja de este precio de toma:')?.trim()
    if (!motivo) return
    const r = await fetch(`/api/admin/precios/toma?id=${id}&motivo=${encodeURIComponent(motivo)}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!r.ok) {
      const d = await r.json()
      return toast('error', d.error || 'Error')
    }
    toast('success', 'Eliminado')
    setRows(prev => prev.filter(x => x.id !== id))
  }

  const campo = (key: keyof TomaValores, label: string, requerido = false, autoFocus = false) => {
    if (!modal) return null
    const err = key === 'modelo' ? errorModelo : ''
    const numerico = key !== 'modelo'
    return (
      <div>
        <label htmlFor={`tm-${key}`} style={labelStyle}>
          {label}
          {requerido ? ' *' : ''}
        </label>
        <input
          ref={autoFocus ? modeloRef : undefined}
          id={`tm-${key}`}
          type={numerico ? 'number' : 'text'}
          min={numerico ? 0 : undefined}
          className="pe-input"
          style={{ ...inputStyle, ...(err ? inputErrorStyle : {}) }}
          value={String(modal.valores[key])}
          aria-invalid={err ? true : undefined}
          aria-describedby={err ? `tm-${key}-error` : undefined}
          onChange={e =>
            setModal({
              ...modal,
              valores: {
                ...modal.valores,
                [key]: numerico ? Number(e.target.value) : e.target.value,
              },
            })
          }
          onFocus={numerico ? ev => ev.currentTarget.select() : undefined}
          onBlur={
            key === 'modelo'
              ? () => {
                  if (!modal.valores.modelo.trim()) setErrorModelo('El modelo es obligatorio')
                  else setErrorModelo('')
                }
              : undefined
          }
        />
        {err && (
          <p
            id={`tm-${key}-error`}
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
    <div style={{ padding: 8 }}>
      <style>{`
        .te-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        .te-grid .te-full { grid-column: 1 / -1; }
        @media (max-width: 520px) { .te-grid { grid-template-columns: 1fr; } }
        .pe-input:focus { border-color: #FF6B2C !important; outline: none; }
        .pe-btn:focus-visible { outline: 2px solid #FF6B2C; outline-offset: 2px; }
        .pe-add:not(:disabled):hover { filter: brightness(.94); }
        .pe-iconbtn:hover:not(:disabled) { filter: brightness(.94); }
        .pe-cancel:hover:not(:disabled) { background: #E4E7EF !important; }
        .pm-card { animation: pmin .16s ease-out; }
        @keyframes pmin { from { opacity: 0; transform: translateY(8px) scale(.985); } to { opacity: 1; transform: none; } }
        .pe-spin { animation: pes 1s linear infinite; }
        @keyframes pes { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) {
          .pe-spin { animation: none !important; }
          .pm-card { animation: none !important; }
        }
      `}</style>

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

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 14,
          flexWrap: 'wrap',
        }}
      >
        <input
          className="pe-input"
          style={{ ...inputStyle, flex: '1 1 200px', maxWidth: 320, minWidth: 0 }}
          placeholder="Buscar..."
          value={buscar}
          onChange={e => setBuscar(e.target.value)}
          aria-label="Buscar modelo en precios de toma"
        />
        <button
          onClick={abrirNuevo}
          className="pe-btn pe-add"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            background: 'linear-gradient(135deg,#FF6B2C,#FF8A50)',
            color: '#fff',
            padding: '10px 18px',
            border: 'none',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'filter .15s',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 17 }} aria-hidden="true">
            add
          </span>
          Agregar modelo
        </button>
      </div>

      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', border: '1px solid #E6E7F0', borderRadius: 10 }}>
        <table
          style={{
            width: '100%',
            minWidth: 720,
            borderCollapse: 'collapse',
            fontSize: 12.5,
            whiteSpace: 'nowrap',
          }}
        >
          <thead>
            <tr style={{ background: '#F4F6F9', textAlign: 'left' }}>
              <th scope="col" style={{ padding: 8 }}>
                Modelo
              </th>
              <th scope="col" style={{ padding: 8 }}>
                Imp
              </th>
              {CAMPOS.slice(1).map(c => (
                <th key={c.key} scope="col" style={{ padding: 8 }}>
                  {c.label.split(' ')[0]}
                </th>
              ))}
              <th scope="col" style={{ padding: 8 }}>
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={11} style={{ padding: 18, textAlign: 'center', color: '#8892A6' }}>
                  Cargando…
                </td>
              </tr>
            )}
            {!cargando && filtrados.length === 0 && (
              <tr>
                <td colSpan={11} style={{ padding: 18, textAlign: 'center', color: '#8892A6' }}>
                  {buscar
                    ? 'Sin resultados para tu búsqueda.'
                    : 'No hay modelos cargados. Agregá uno.'}
                </td>
              </tr>
            )}
            {filtrados.map(r => (
              <tr key={r.id} style={{ borderTop: '1px solid #E6E7F0' }}>
                <td style={{ padding: 8, fontWeight: 600 }}>{r.modelo}</td>
                <td style={{ padding: 8 }}>{fmtARS(r.impecable)}</td>
                {CAMPOS.slice(1).map(c => (
                  <td key={c.key} style={{ padding: 8, color: '#C0392B' }}>
                    {fmtARS(r[c.key])}
                  </td>
                ))}
                <td style={{ padding: 6, whiteSpace: 'nowrap' }}>
                  <button
                    onClick={() => abrirEditar(r)}
                    className="pe-btn pe-iconbtn"
                    aria-label={`Editar ${r.modelo}`}
                    title="Editar"
                    style={{
                      marginRight: 6,
                      padding: '5px 8px',
                      background: '#2563EB',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 7,
                      cursor: 'pointer',
                      verticalAlign: 'middle',
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 14, display: 'block' }}
                      aria-hidden="true"
                    >
                      edit
                    </span>
                  </button>
                  <button
                    onClick={() => eliminar(r.id)}
                    className="pe-btn pe-iconbtn"
                    aria-label={`Eliminar ${r.modelo}`}
                    title="Eliminar"
                    style={{
                      padding: '5px 8px',
                      background: '#DC2626',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 7,
                      cursor: 'pointer',
                      verticalAlign: 'middle',
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 14, display: 'block' }}
                      aria-hidden="true"
                    >
                      delete
                    </span>
                  </button>
                </td>
              </tr>
            ))}
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
            role="dialog"
            aria-modal="true"
            aria-labelledby="te-titulo"
            ref={modalRef}
            tabIndex={-1}
            className="pm-card"
            style={{
              position: 'relative',
              zIndex: 1,
              width: 'min(92vw, 560px)',
              maxHeight: '90vh',
              overflow: 'auto',
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
                id="te-titulo"
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
                {modal.modo === 'nuevo' ? 'Nuevo modelo de toma' : 'Editar modelo'}
              </h2>
              <button
                onClick={cerrarModal}
                disabled={guardando}
                className="pe-btn pe-iconbtn"
                aria-label="Cerrar"
                title="Cerrar (Esc)"
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
              Cargá el precio del equipo impecable y cuánto se descuenta por cada falla.
            </p>

            <div className="te-grid" style={{ marginTop: 10 }}>
              <div className="te-full">{campo('modelo', 'Modelo', true, true)}</div>
              {CAMPOS.map(c => campo(c.key, c.label))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button
                onClick={cerrarModal}
                disabled={guardando}
                className="pe-btn pe-cancel"
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
  )
}
