'use client'

import { useEffect, useRef, useState } from 'react'
import AdminTopbar from '@/components/AdminTopbar'
import { MoneyInput, PctInput, CuilInput } from '@/components/campos'
import { parseMiles, formatMilesInput } from '@/lib/formato'

const OPERADORES = ['Martin', 'Maca', 'Sam', 'Eva', 'Buda']
const TOTAL = 6
const STEPS = ['Operación', 'Equipo', 'Precio y pago', 'Reparación', 'Preventa', 'Confirmar']
const OTRO_MODELO = '__otro__'
const OTRO_VALOR = '__otro__'
// Presets para evitar que se cargue un número suelto ("8" en vez de "8 GB")
// en equipos que no son iPhone, donde no hay Lista de Precios de la que
// derivar el almacenamiento/RAM automáticamente.
const STORAGE_PRESETS = ['64 GB', '128 GB', '256 GB', '512 GB', '1 TB', '2 TB']
const RAM_PRESETS = ['4 GB', '6 GB', '8 GB', '12 GB', '16 GB', '32 GB', '64 GB']
// Paleta genérica en español (mismos nombres/colores que ya usa el catálogo
// para marcas sin colores curados — public/lib/render.js) para que el color
// cargado acá matchee con los círculos que se ven después en el detalle del
// producto, en vez de un texto libre que puede no coincidir con nada.
const GENERIC_COLORS: [string, string][] = [
  ['Negro', '#1d1d1f'],
  ['Blanco', '#f5f5f0'],
  ['Plateado', '#eae9e6'],
  ['Grafito', '#555556'],
  ['Dorado', '#f7e0b0'],
  ['Azul', '#3b78c4'],
  ['Rojo', '#d32f2f'],
  ['Verde', '#78b86a'],
  ['Amarillo', '#f3d060'],
  ['Rosa', '#f7c8d0'],
  ['Púrpura', '#b07dd8'],
]

// La Lista de Precios (PriceList.colors) guarda los nombres en inglés,
// tal como los publica Apple (Black, Space Gray, Deep Purple, etc.).
const COLOR_HEX: Record<string, string> = {
  'Black': '#1a1a1a',
  'Black Titanium': '#3b3b3b',
  'Blue': '#3182ce',
  'Blue Titanium': '#3a4a5c',
  'Coral': '#fc8181',
  'Deep Purple': '#5e5375',
  'Desert Titanium': '#a68b6c',
  'Gold': '#d69e2e',
  'Graphite': '#4a4a4a',
  'Gray': '#a0aec0',
  'Green': '#38a169',
  'Indigo Titanium': '#4f5b93',
  'Midnight': '#1c1c28',
  'Midnight Green': '#25332c',
  'Natural Titanium': '#8f8a81',
  'Orange': '#ed8936',
  'Pacific Blue': '#1f5f6e',
  'Pink': '#ed64a6',
  'Product Red': '#e53e3e',
  'Purple': '#805ad5',
  'Red': '#e53e3e',
  'Rose Gold': '#d88ba0',
  'Sierra Blue': '#a8c5d6',
  'Silver': '#e0e0e0',
  'Space Black': '#1a1a1a',
  'Space Gray': '#5f5f5f',
  'Starlight': '#f0e6d2',
  'Teal': '#2c7a7b',
  'Ultramarine': '#3a5fcd',
  'White': '#f0f0f0',
  'White Titanium': '#e8e6e0',
  'Yellow': '#ecc94b',
  'Alpine Green': '#4a5c4c',
}
function colorHex(name: string) {
  if (COLOR_HEX[name]) return COLOR_HEX[name]
  const found = Object.keys(COLOR_HEX).find(k => k.toLowerCase() === name?.trim().toLowerCase())
  return found ? COLOR_HEX[found] : '#ccc'
}

function fmt(n: number) {
  return '$' + (n || 0).toLocaleString('es-AR')
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 10,
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
  fontSize: 12.5,
  fontWeight: 600,
  color: '#3D4356',
  marginTop: 14,
  marginBottom: 5,
}

export default function ComprasClient() {
  const [operador, setOperador] = useState('')
  const [tipo, setTipo] = useState('COMPRA')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [proveedor, setProveedor] = useState('')
  const [cuil, setCuil] = useState('')
  const [modelo, setModelo] = useState('')
  const [imei, setImei] = useState('')
  const [battery, setBattery] = useState('')
  const [color, setColor] = useState('')
  const [storage, setStorage] = useState('')
  const [ram, setRam] = useState('')
  const [isCustomStorage, setIsCustomStorage] = useState(false)
  const [isCustomRam, setIsCustomRam] = useState(false)
  const [deviceType, setDeviceType] = useState('celular')
  const [marca, setMarca] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [estadoFisico, setEstadoFisico] = useState('Bueno')
  const [precioCompra, setPrecioCompra] = useState('')
  const [precioConsig, setPrecioConsig] = useState('')
  const [formaPago, setFormaPago] = useState('Efectivo')
  const [reparacion, setReparacion] = useState('No')
  const [costoRep, setCostoRep] = useState('')
  const [precioVenta, setPrecioVenta] = useState('')
  const [esPreventa, setEsPreventa] = useState('No')
  const [preventas, setPreventas] = useState<
    { id: string; code: string; clientName: string; productModelName: string | null }[]
  >([])
  const [nPre, setNPre] = useState('')
  const [obs, setObs] = useState('')

  const [priceList, setPriceList] = useState<
    { modelo: string; almacenamiento: string; imageUrl: string | null; colors: string[]; precioARS: number }[]
  >([])
  const [iPhoneModels, setIPhoneModels] = useState<string[]>([])
  const [storages, setStorages] = useState<string[]>([])
  const [colors, setColors] = useState<string[]>([])
  const [modeloCustom, setModeloCustom] = useState('')
  const [isCustomModel, setIsCustomModel] = useState(false)
  const [selectValue, setSelectValue] = useState('')

  const [step, setStep] = useState(1)
  const [maxStep, setMaxStep] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverMsg, setServerMsg] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState<{ numero: string; estado: string } | null>(null)
  const errRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let activo = true
    Promise.all([
      fetch('/api/admin/ops/compras', { credentials: 'include' }).then(r => {
        if (!r.ok) throw new Error('preventas')
        return r.json()
      }),
      fetch('/api/admin/precios', { credentials: 'include' }).then(r => {
        if (!r.ok) throw new Error('precios')
        return r.json()
      }),
    ])
      .then(([prevs, precios]) => {
        if (!activo) return
        setPreventas(Array.isArray(prevs) ? prevs : [])
        if (Array.isArray(precios)) {
          setPriceList(precios)
          const iPhones = [...new Set(
            precios.filter((p: any) => p.modelo?.toLowerCase().includes('iphone')).map((p: any) => p.modelo as string)
          )].sort()
          setIPhoneModels(iPhones)
        }
      })
      .catch(() => {
        if (activo) setServerMsg('No se pudieron cargar los datos (preventas/precios). Recargá la página.')
      })
    return () => {
      activo = false
    }
  }, [])

  // Cuando cambia el modelo seleccionado, derivar storages, colores e imagen
  // de la Lista de Precios ya cargada (sin volver a pedir al servidor).
  useEffect(() => {
    if (!modelo) {
      setStorage('')
      setStorages([])
      setColors([])
      setImageUrl('')
      return
    }

    const filtered = priceList.filter(p => p.modelo === modelo)
    if (filtered.length === 0) {
      setStorages([])
      setColors([])
      setImageUrl('')
      return
    }

    const uniqueStorages = [...new Set(filtered.map(p => p.almacenamiento).filter(Boolean))]
    setStorages(uniqueStorages)
    setStorage(prev => (uniqueStorages.includes(prev) ? prev : uniqueStorages[0] || ''))

    const uniqueColors = [...new Set(filtered.flatMap(p => p.colors || []))]
    setColors(uniqueColors)
    setColor(prev => (uniqueColors.includes(prev) ? prev : uniqueColors[0] || ''))

    const withImage = filtered.find(p => p.imageUrl)
    setImageUrl(withImage?.imageUrl || '')
  }, [modelo, priceList])

  const validarPaso = (p: number): Record<string, string> => {
    const e: Record<string, string> = {}
    if (p === 1 && !operador) e.operador = 'Seleccioná el operador'
    if (p === 2) {
      if (!modelo.trim()) e.modelo = 'Ingresá el modelo del equipo'
      // El IMEI de 15 dígitos solo aplica a iPhone. Para otros modelos es un
      // N° de serie libre y totalmente opcional, igual que la batería.
      if (!isCustomModel && imei.trim() && !/^\d{15}$/.test(imei.trim()))
        e.imei = 'El IMEI debe tener exactamente 15 números'
      if (battery !== '' && (parseMiles(battery) < 0 || parseMiles(battery) > 100)) e.battery = 'La batería debe estar entre 0 y 100'
    }
    if (p === 3) {
      if (tipo === 'COMPRA' && (parseMiles(precioCompra) <= 0))
        e.precioCompra = 'El precio de compra debe ser mayor a 0'
      if (tipo === 'CONSIGNACION' && (parseMiles(precioConsig) <= 0))
        e.precioConsig = 'El precio acordado debe ser mayor a 0'
    }
    if (p === 4 && reparacion === 'Sí') {
      if (costoRep !== '' && parseMiles(costoRep) < 0) e.costoRep = 'El costo no puede ser negativo'
      if (precioVenta !== '' && parseMiles(precioVenta) < 0) e.precioVenta = 'El precio no puede ser negativo'
    }
    if (p === 5 && esPreventa === 'Si' && !nPre) e.nPre = 'Seleccioná la preventa a vincular'
    return e
  }

  const limpiarError = (id: string) =>
    setErrors(prev => {
      if (!prev[id]) return prev
      const n = { ...prev }
      delete n[id]
      return n
    })

  const validarEnBlur = (id: string) =>
    setErrors(prev => {
      const nuevo = validarPaso(step)[id]
      if (nuevo && !prev[id]) return { ...prev, [id]: nuevo }
      if (!nuevo && prev[id]) {
        const n = { ...prev }
        delete n[id]
        return n
      }
      return prev
    })

  const irAPaso = (dest: number) => {
    if (dest > step) {
      const e = validarPaso(step)
      setErrors(e)
      if (Object.keys(e).length > 0) {
        requestAnimationFrame(() => {
          errRef.current?.focus({ preventScroll: true })
          errRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        })
        return
      }
    }
    setServerMsg(null)
    setErrors({})
    setStep(dest)
    setMaxStep(m => Math.max(m, dest))
  }

  const resetear = () => {
    setModelo('')
    setImei('')
    setBattery('')
    setProveedor('')
    setCuil('')
    setColor('')
    setStorage('')
    setRam('')
    setIsCustomStorage(false)
    setIsCustomRam(false)
    setDeviceType('celular')
    setMarca('')
    setImageUrl('')
    setModeloCustom('')
    setIsCustomModel(false)
    setSelectValue('')
    setStorages([])
    setColors([])
    setPrecioCompra('')
    setPrecioConsig('')
    setCostoRep('')
    setPrecioVenta('')
    setObs('')
    setEsPreventa('No')
    setNPre('')
    setReparacion('No')
    setEstadoFisico('Bueno')
    setFormaPago('Efectivo')
    setFecha(new Date().toISOString().split('T')[0])
    setStep(1)
    setMaxStep(1)
    setErrors({})
    setServerMsg(null)
    setDone(null)
  }

  const enviar = async () => {
    const e = validarPaso(3)
    const e5 = validarPaso(5)
    const todos = { ...e, ...e5 }
    if (Object.keys(todos).length > 0) {
      setErrors(todos)
      const primero = Object.keys(todos)[0]
      const pasoDelError =
        primero === 'operador' ? 1 : primero === 'modelo' ? 2 : primero.startsWith('precio') ? 3 : 5
      setStep(pasoDelError)
      requestAnimationFrame(() => {
        errRef.current?.focus({ preventScroll: true })
        errRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
      return
    }
    setSending(true)
    setServerMsg(null)
    try {
      const r = await fetch('/api/admin/ops/compras', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          fecha,
          proveedor,
          cuil,
          modelo,
          marca,
          deviceType,
          imei,
          battery: battery !== '' ? parseMiles(battery) : undefined,
          color,
          storage,
          ram: ram || undefined,
          imageUrl,
          estadoFisico,
          precioCompra: parseMiles(precioCompra),
          precioConsig: parseMiles(precioConsig),
          formaPago,
          reparacion,
          costoRep: parseMiles(costoRep),
          precioVenta: parseMiles(precioVenta),
          esPreventa,
          nPreAsociada: esPreventa === 'Si' ? nPre : '',
          operador,
          obs,
        }),
      })
      const d = await r.json()
      if (!r.ok) {
        setServerMsg(d.error || 'Error al registrar la compra')
        return
      }
      setDone({ numero: d.numero, estado: d.estado })
    } catch {
      setServerMsg('Error de conexión. Intentá de nuevo.')
    } finally {
      setSending(false)
    }
  }

  const fieldProps = (id: string) => ({
    id,
    style: { ...inputStyle, ...(errors[id] ? inputErrorStyle : {}) },
    'aria-invalid': errors[id] ? true : undefined,
    'aria-describedby': errors[id] ? `${id}-error` : undefined,
  })

  const preventaSel = preventas.find(p => p.id === nPre)

  const precioListaMatch =
    priceList.find(p => p.modelo === modelo && (!storage || p.almacenamiento === storage))?.precioARS || 0

  if (done) {
    return (
      <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
        <style>{`
          .cw-btn:focus-visible { outline: 2px solid #FF6B2C; outline-offset: 2px; }
          .cw-primary:not(:disabled):hover { filter: brightness(.94); }
        `}</style>
        <div
          role="status"
          style={{
            background: '#fff',
            border: '1px solid #E6E7F0',
            borderRadius: 14,
            padding: '48px 24px',
            textAlign: 'center',
            boxShadow: '0 1px 2px rgba(23,23,45,.04),0 6px 20px rgba(23,23,45,.06)',
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 56, color: '#0F9D58' }}
            aria-hidden="true"
          >
            check_circle
          </span>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#181B2E', margin: '12px 0 4px' }}>
            Compra registrada
          </h2>
          <p style={{ fontSize: 13.5, color: '#6B7280', margin: 0 }}>
            Operación <strong style={{ color: '#181B2E' }}>{done.numero}</strong> · Estado:{' '}
            <strong style={{ color: '#181B2E' }}>{done.estado}</strong>
          </p>
          <button
            onClick={resetear}
            className="cw-btn cw-primary"
            style={{
              marginTop: 24,
              background: 'linear-gradient(135deg,#FF6B2C,#FF8A50)',
              color: '#fff',
              padding: '11px 28px',
              border: 'none',
              borderRadius: 10,
              fontSize: 13.5,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Cargar otra compra
          </button>
        </div>
      </div>
    )
  }

  const resumen: [string, string][] = [
    ['Operador', operador || '—'],
    [
      'Tipo de ingreso',
      tipo === 'COMPRA' ? 'COMPRA — equipo propio' : 'CONSIGNACIÓN — equipo de tercero',
    ],
    ['Fecha', fecha],
    ['Proveedor', proveedor || '—'],
    ['Modelo', modelo || '—'],
    ...(isCustomModel
      ? ([[
          'Tipo de dispositivo',
          ({ celular: 'Celular', tablet: 'Tablet', laptop: 'Laptop', desktop: 'Desktop' } as Record<string, string>)[deviceType] || deviceType,
        ]] as [string, string][])
      : []),
    ['IMEI / Serie', imei || '—'],
    ['Batería', battery !== '' ? `${battery}%` : '—'],
    ['Almacenamiento', storage || '—'],
    ['Color', color || '—'],
    ['RAM', ram || '—'],
    ['Estado físico', estadoFisico],
    [
      tipo === 'COMPRA' ? 'Precio de compra' : 'Precio consignación',
      fmt(+(tipo === 'COMPRA' ? precioCompra : precioConsig) || 0),
    ],
    ['Forma de pago', formaPago],
    [
      '¿Necesita arreglo?',
      reparacion === 'Sí'
        ? `Sí — ${fmt(parseMiles(costoRep))} (venta est. ${fmt(parseMiles(precioVenta))})`
        : 'No',
    ],
    [
      'Preventa vinculada',
      esPreventa === 'Si' && preventaSel ? `${preventaSel.code} → ${preventaSel.clientName}` : 'No',
    ],
  ]

  return (
    <>
      <AdminTopbar titulo="Registrar Compra" />
      <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
        <style>{`
        .cw-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .cw-radio-grid{ display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:12px; }
        @media (max-width: 640px) { .cw-grid { grid-template-columns: 1fr; } .cw-steplabel { display: none; } }
        @media (max-width: 380px){ .cw-radio-grid{ grid-template-columns:1fr; } }
        .cw-input:focus { border-color: #FF6B2C !important; outline: none; }
        .cw-select {
          appearance: none;
          -webkit-appearance: none;
          cursor: pointer;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='9' viewBox='0 0 14 9'%3E%3Cpath d='M1 1l6 6 6-6' fill='none' stroke='%2364748B' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          padding-right: 34px !important;
        }
        .cw-select:focus { border-color: #FF6B2C !important; outline: none; }
        .cw-btn:focus-visible { outline: 2px solid #FF6B2C; outline-offset: 2px; }
        .cw-primary:not(:disabled):hover { filter: brightness(.94); }
        .cw-back:not(:disabled):hover { background: #F4F6F9; }
        .cw-dot-btn:focus-visible { outline: 2px solid #FF6B2C; outline-offset: 2px; }
        .cw-spin { animation: cws 1s linear infinite; }
        @keyframes cws { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) {
          .cw-spin { animation: none !important; }
          .cw-bar, .cw-dot-btn, .cw-btn { transition: none !important; }
        }
      `}</style>

        <p style={{ fontSize: 13, color: '#6B7280', margin: '2px 0 18px' }}>
          Compra de equipos o consignación para el local
        </p>

        <nav aria-label="Progreso del formulario">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginBottom: 8,
            }}
          >
            <p
              style={{ fontSize: 12.5, fontWeight: 700, color: '#181B2E', margin: 0 }}
              aria-hidden="true"
            >
              Paso {step} de {TOTAL} · {STEPS[step - 1]}
            </p>
            <p style={{ fontSize: 11.5, color: '#94A3B8', margin: 0 }} aria-hidden="true">
              {Math.round((step / TOTAL) * 100)}%
            </p>
          </div>
          <div
            style={{ height: 5, background: '#EDF0F6', borderRadius: 99, overflow: 'hidden' }}
            aria-hidden="true"
          >
            <div
              className="cw-bar"
              style={{
                height: '100%',
                width: `${(step / TOTAL) * 100}%`,
                background: 'linear-gradient(90deg,#FF6B2C,#FF8A50)',
                borderRadius: 99,
                transition: 'width .25s ease',
              }}
            />
          </div>
          <ol
            style={{
              display: 'flex',
              alignItems: 'center',
              listStyle: 'none',
              margin: '14px 0 0',
              padding: 0,
            }}
          >
            {STEPS.map((label, i) => {
              const n = i + 1
              const completo = n < step
              const activo = n === step
              const alcanzable = n <= maxStep
              return (
                <li
                  key={label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flex: n < TOTAL ? 1 : '0 0 auto',
                    minWidth: 0,
                  }}
                >
                  <button
                    type="button"
                    className="cw-dot-btn"
                    onClick={() => alcanzable && irAPaso(n)}
                    disabled={!alcanzable}
                    aria-label={`Paso ${n}: ${label}${activo ? ' (actual)' : completo ? ' (completado)' : ''}`}
                    aria-current={activo ? 'step' : undefined}
                    title={label}
                    style={{
                      flexShrink: 0,
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      border: activo
                        ? '2.5px solid #FF6B2C'
                        : '2px solid ' + (completo ? '#FFD3BC' : '#E6E7F0'),
                      background: activo ? '#FF6B2C' : completo ? '#FFF1E8' : '#FBFBFD',
                      color: activo ? '#fff' : completo ? '#FF6B2C' : '#B6BCCB',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: alcanzable ? 'pointer' : 'default',
                      transition: 'background .15s, border-color .15s',
                    }}
                  >
                    {completo ? (
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: 16 }}
                        aria-hidden="true"
                      >
                        check
                      </span>
                    ) : (
                      n
                    )}
                  </button>
                  {n < TOTAL && (
                    <>
                      <span
                        className="cw-steplabel"
                        style={{
                          fontSize: 11,
                          fontWeight: activo ? 700 : 500,
                          color: activo ? '#FF6B2C' : completo ? '#F08A4B' : '#B6BCCB',
                          marginLeft: 6,
                          marginRight: 8,
                          whiteSpace: 'nowrap',
                        }}
                        aria-hidden="true"
                      >
                        {label}
                      </span>
                      <span
                        aria-hidden="true"
                        style={{
                          flex: 1,
                          minWidth: 8,
                          height: 2,
                          background: completo ? '#FFD3BC' : '#EDF0F6',
                          borderRadius: 2,
                          marginRight: 6,
                        }}
                      />
                    </>
                  )}
                </li>
              )
            })}
          </ol>
          <p
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              overflow: 'hidden',
              clip: 'rect(0 0 0 0)',
              whiteSpace: 'nowrap',
            }}
            role="status"
          >
            {`Paso ${step} de ${TOTAL}: ${STEPS[step - 1]}`}
          </p>
        </nav>

        <form
          onSubmit={ev => {
            ev.preventDefault()
            if (step < TOTAL) irAPaso(step + 1)
            else enviar()
          }}
          style={{
            background: '#fff',
            border: '1px solid #E6E7F0',
            borderRadius: 14,
            padding: 24,
            marginTop: 16,
            boxShadow: '0 1px 2px rgba(23,23,45,.04),0 6px 20px rgba(23,23,45,.06)',
          }}
        >
          {Object.keys(errors).length > 0 && (
            <div
              ref={errRef}
              tabIndex={-1}
              role="alert"
              aria-labelledby="cw-error-title"
              style={{
                background: '#FEF2F2',
                borderLeft: '4px solid #DC2626',
                borderRadius: 8,
                padding: '12px 14px',
                marginBottom: 16,
                outline: 'none',
              }}
            >
              <p
                id="cw-error-title"
                style={{ fontSize: 13, fontWeight: 700, color: '#B91C1C', margin: '0 0 6px' }}
              >
                Revisá estos datos para continuar:
              </p>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {Object.entries(errors).map(([id, txt]) => (
                  <li key={id}>
                    <a href={`#${id}`} style={{ fontSize: 12.5, color: '#DC2626' }}>
                      {txt}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {serverMsg && (
            <div
              role="alert"
              style={{
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: 8,
                padding: '11px 14px',
                marginBottom: 16,
                color: '#B91C1C',
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              {serverMsg}
            </div>
          )}

          {step === 1 && (
            <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend style={{ fontSize: 15, fontWeight: 800, color: '#181B2E', marginBottom: 2 }}>
                ¿Quién carga esto y qué tipo de ingreso es?
              </legend>
              <label htmlFor="operador" style={labelStyle}>
                Operador *
              </label>
              <select
                {...fieldProps('operador')}
                className="cw-input"
                value={operador}
                onChange={e => {
                  setOperador(e.target.value)
                  limpiarError('operador')
                }}
                onBlur={() => validarEnBlur('operador')}
              >
                <option value="" disabled>
                  Seleccionar...
                </option>
                {OPERADORES.map(o => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              {errors.operador && (
                <p
                  id="operador-error"
                  style={{ fontSize: 12, color: '#DC2626', margin: '5px 0 0' }}
                >
                  {errors.operador}
                </p>
              )}

              <label htmlFor="tipo" style={labelStyle}>
                Tipo de ingreso *
              </label>
              <select
                {...fieldProps('tipo')}
                className="cw-input"
                value={tipo}
                onChange={e => setTipo(e.target.value)}
              >
                <option value="COMPRA">COMPRA — equipo propio</option>
                <option value="CONSIGNACION">CONSIGNACION — equipo de tercero</option>
              </select>
              <p style={{ fontSize: 11.5, color: '#6B7280', margin: '5px 0 0', lineHeight: 1.5 }}>
                {tipo === 'COMPRA'
                  ? 'COMPRA: el equipo pasa a ser stock propio del local.'
                  : 'CONSIGNACIÓN: el equipo sigue siendo de tercero hasta que se venda.'}
              </p>

              <label htmlFor="fecha" style={labelStyle}>
                Fecha
              </label>
              <input
                type="date"
                {...fieldProps('fecha')}
                className="cw-input"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
              />
            </fieldset>
          )}

          {step === 2 && (
            <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend style={{ fontSize: 15, fontWeight: 800, color: '#181B2E', marginBottom: 2 }}>
                Datos del equipo
              </legend>
              <div className="cw-grid" style={{ marginTop: 12 }}>
                <div>
                  <label htmlFor="proveedor" style={{ ...labelStyle, marginTop: 0 }}>
                    Proveedor / Origen
                  </label>
                  <input
                    {...fieldProps('proveedor')}
                    className="cw-input"
                    value={proveedor}
                    onChange={e => setProveedor(e.target.value)}
                    placeholder="Ej: Juan Pérez, Particular"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label htmlFor="cuil" style={{ ...labelStyle, marginTop: 0 }}>
                    CUIL/CUIT proveedor
                  </label>
                  <CuilInput
                    {...fieldProps('cuil')}
                    className="cw-input"
                    value={cuil}
                    onChange={setCuil}
                  />
                </div>
              </div>
              {/* Modelo */}
              <div style={{ marginTop: 14 }}>
                <label htmlFor="modeloSelect" style={{ ...labelStyle, marginTop: 0 }}>
                  Equipo / Modelo *
                </label>
                <select
                  id="modeloSelect"
                  className="cw-select"
                  style={{ ...inputStyle, ...(errors.modelo ? inputErrorStyle : {}) }}
                  value={selectValue}
                  onChange={e => {
                    const v = e.target.value
                    setSelectValue(v)
                    if (v === OTRO_MODELO) {
                      setIsCustomModel(true)
                      setModelo(modeloCustom)
                      setMarca('')
                      setStorage('')
                      setColor('')
                      setRam('')
                      setIsCustomStorage(false)
                      setIsCustomRam(false)
                      setDeviceType('celular')
                      setColors([])
                      setStorages([])
                      setImageUrl('')
                    } else {
                      setIsCustomModel(false)
                      setModelo(v)
                      setMarca(v ? 'Apple' : '')
                      setModeloCustom('')
                      setRam('')
                      setDeviceType('celular')
                    }
                    limpiarError('modelo')
                  }}
                  onBlur={() => validarEnBlur('modelo')}
                >
                  <option value="">Seleccionar modelo iPhone...</option>
                  {iPhoneModels.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  <option value={OTRO_MODELO}>Otro modelo (no es iPhone)...</option>
                </select>

                {isCustomModel && (
                  <div className="cw-grid" style={{ marginTop: 10 }}>
                    <div>
                      <label htmlFor="modeloCustom" style={{ ...labelStyle, marginTop: 0, fontSize: 11.5 }}>
                        Especificá el modelo *
                      </label>
                      <input
                        id="modeloCustom"
                        className="cw-input"
                        style={{ ...inputStyle, ...(errors.modelo ? inputErrorStyle : {}) }}
                        value={modeloCustom}
                        onChange={e => {
                          setModeloCustom(e.target.value)
                          setModelo(e.target.value)
                          limpiarError('modelo')
                        }}
                        onBlur={() => validarEnBlur('modelo')}
                        placeholder="Ej: Samsung Galaxy S21"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label htmlFor="marcaCustom" style={{ ...labelStyle, marginTop: 0, fontSize: 11.5 }}>
                        Marca *
                      </label>
                      <input
                        id="marcaCustom"
                        className="cw-input"
                        style={inputStyle}
                        value={marca}
                        onChange={e => setMarca(e.target.value)}
                        placeholder="Ej: Samsung"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label htmlFor="deviceTypeCustom" style={{ ...labelStyle, marginTop: 0, fontSize: 11.5 }}>
                        Tipo de dispositivo
                      </label>
                      <select
                        id="deviceTypeCustom"
                        className="cw-select"
                        style={inputStyle}
                        value={deviceType}
                        onChange={e => setDeviceType(e.target.value)}
                      >
                        <option value="celular">Celular</option>
                        <option value="tablet">Tablet</option>
                        <option value="laptop">Laptop</option>
                        <option value="desktop">Desktop</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="storageCustom" style={{ ...labelStyle, marginTop: 0, fontSize: 11.5 }}>
                        Almacenamiento
                      </label>
                      <select
                        id="storageCustom"
                        className="cw-select"
                        style={inputStyle}
                        value={isCustomStorage ? OTRO_VALOR : storage}
                        onChange={e => {
                          if (e.target.value === OTRO_VALOR) {
                            setIsCustomStorage(true)
                            setStorage('')
                          } else {
                            setIsCustomStorage(false)
                            setStorage(e.target.value)
                          }
                        }}
                      >
                        <option value="">Sin especificar</option>
                        {STORAGE_PRESETS.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                        <option value={OTRO_VALOR}>Otro (especificar)...</option>
                      </select>
                      {isCustomStorage && (
                        <input
                          className="cw-input"
                          style={{ ...inputStyle, marginTop: 8 }}
                          value={storage}
                          onChange={e => setStorage(e.target.value)}
                          placeholder="Ej: 1 TB SSD, 500 GB HDD"
                          autoComplete="off"
                          autoFocus
                        />
                      )}
                    </div>
                    <div>
                      <label style={{ ...labelStyle, marginTop: 0, fontSize: 11.5 }}>Color</label>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingTop: 2 }}>
                        {GENERIC_COLORS.map(([name, hex]) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => setColor(name)}
                            title={name}
                            aria-label={name}
                            aria-pressed={color === name}
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: '50%',
                              backgroundColor: hex,
                              border: color === name ? '2.5px solid #FF6B2C' : '1.5px solid #E6E7F0',
                              boxShadow: color === name
                                ? '0 0 0 2px #FFF, 0 0 0 4px #FF6B2C33'
                                : '0 1px 3px rgba(0,0,0,.08)',
                              cursor: 'pointer',
                              transition: 'all .15s',
                              padding: 0,
                            }}
                          />
                        ))}
                      </div>
                      {color && (
                        <p style={{ fontSize: 11, color: '#94A3B8', margin: '6px 0 0' }}>
                          Seleccionado: <strong style={{ color: '#181B2E' }}>{color}</strong>
                        </p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="ramCustom" style={{ ...labelStyle, marginTop: 0, fontSize: 11.5 }}>
                        RAM
                      </label>
                      <select
                        id="ramCustom"
                        className="cw-select"
                        style={inputStyle}
                        value={isCustomRam ? OTRO_VALOR : ram}
                        onChange={e => {
                          if (e.target.value === OTRO_VALOR) {
                            setIsCustomRam(true)
                            setRam('')
                          } else {
                            setIsCustomRam(false)
                            setRam(e.target.value)
                          }
                        }}
                      >
                        <option value="">Sin especificar</option>
                        {RAM_PRESETS.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                        <option value={OTRO_VALOR}>Otro (especificar)...</option>
                      </select>
                      {isCustomRam && (
                        <input
                          className="cw-input"
                          style={{ ...inputStyle, marginTop: 8 }}
                          value={ram}
                          onChange={e => setRam(e.target.value)}
                          placeholder="Ej: 8 GB"
                          autoComplete="off"
                          autoFocus
                        />
                      )}
                    </div>
                  </div>
                )}

                {errors.modelo && (
                  <p style={{ fontSize: 12, color: '#DC2626', margin: '6px 0 0' }}>
                    {errors.modelo}
                  </p>
                )}
              </div>

              {/* Almacenamiento y Color */}
              {(storages.length > 0 || colors.length > 0) && (
                <div
                  style={{
                    marginTop: 14,
                    padding: 14,
                    background: '#F7F8FC',
                    border: '1px solid #E6E7F0',
                    borderRadius: 10,
                  }}
                >
                  {storages.length > 0 && (
                    <div>
                      <label style={{ ...labelStyle, marginTop: 0 }}>Almacenamiento</label>
                      <select
                        className="cw-select"
                        style={inputStyle}
                        value={storage}
                        onChange={e => setStorage(e.target.value)}
                      >
                        {storages.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {colors.length > 0 && (
                    <div style={{ marginTop: storages.length > 0 ? 14 : 0 }}>
                      <label style={{ ...labelStyle, marginTop: 0 }}>Color</label>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {colors.map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setColor(c)}
                            title={c}
                            aria-label={c}
                            aria-pressed={color === c}
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: '50%',
                              backgroundColor: colorHex(c),
                              border: color === c ? '2.5px solid #FF6B2C' : '1.5px solid #E6E7F0',
                              boxShadow: color === c
                                ? '0 0 0 2px #FFF, 0 0 0 4px #FF6B2C33'
                                : '0 1px 3px rgba(0,0,0,.08)',
                              cursor: 'pointer',
                              transition: 'all .15s',
                              padding: 0,
                            }}
                          />
                        ))}
                      </div>
                      {color && (
                        <p style={{ fontSize: 11.5, color: '#64748B', margin: '8px 0 0' }}>
                          Seleccionado: <strong style={{ color: '#181B2E' }}>{color}</strong>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* IMEI y Batería */}
              <div className="cw-grid" style={{ marginTop: 14 }}>
                <div>
                  <label htmlFor="imei" style={{ ...labelStyle, marginTop: 0 }}>
                    {isCustomModel ? 'N° de Serie (opcional)' : 'IMEI / N° de Serie'}
                  </label>
                  <input
                    {...fieldProps('imei')}
                    className="cw-input"
                    value={imei}
                    onChange={e => {
                      setImei(
                        isCustomModel
                          ? e.target.value.slice(0, 40)
                          : e.target.value.replace(/\D/g, '').slice(0, 15)
                      )
                      limpiarError('imei')
                    }}
                    onBlur={() => validarEnBlur('imei')}
                    placeholder={isCustomModel ? 'Opcional' : '15 dígitos'}
                    inputMode={isCustomModel ? 'text' : 'numeric'}
                    maxLength={isCustomModel ? 40 : 15}
                    autoComplete="off"
                  />
                  <p style={{ fontSize: 11, color: errors.imei ? '#DC2626' : '#94A3B8', margin: '5px 0 0' }}>
                    {errors.imei || (isCustomModel ? 'Opcional — dejalo vacío si no tiene' : `${imei.length}/15 dígitos`)}
                  </p>
                </div>
                <div>
                  <label htmlFor="battery" style={{ ...labelStyle, marginTop: 0 }}>
                    Batería (%)
                  </label>
                  <PctInput
                    {...fieldProps('battery')}
                    className="cw-input"
                    value={battery}
                    onChange={v => {
                      setBattery(v)
                      limpiarError('battery')
                    }}
                    onBlur={() => validarEnBlur('battery')}
                    placeholder="Ej: 87"
                  />
                  {errors.battery && (
                    <p style={{ fontSize: 12, color: '#DC2626', margin: '5px 0 0' }}>
                      {errors.battery}
                    </p>
                  )}
                </div>
              </div>

              {/* Estado físico */}
              <div style={{ marginTop: 14 }}>
                <label htmlFor="estadoFisico" style={{ ...labelStyle, marginTop: 0 }}>
                  Estado físico
                </label>
                <select
                  {...fieldProps('estadoFisico')}
                  className="cw-select"
                  value={estadoFisico}
                  onChange={e => setEstadoFisico(e.target.value)}
                >
                  <option>Excelente</option>
                  <option>Bueno</option>
                  <option>Regular</option>
                  <option>Para Reparación</option>
                </select>
              </div>
            </fieldset>
          )}

          {step === 3 && (
            <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend style={{ fontSize: 15, fontWeight: 800, color: '#181B2E', marginBottom: 2 }}>
                Precio y forma de pago
              </legend>
              {tipo === 'COMPRA' ? (
                <>
                  <label htmlFor="precioCompra" style={labelStyle}>
                    Precio de compra ($) *
                  </label>
                  <MoneyInput
                    {...fieldProps('precioCompra')}
                    className="cw-input"
                    value={precioCompra}
                    onChange={v => {
                      setPrecioCompra(v)
                      limpiarError('precioCompra')
                    }}
                    onBlur={() => validarEnBlur('precioCompra')}
                    placeholder="0"
                  />
                  {errors.precioCompra && (
                    <p
                      id="precioCompra-error"
                      style={{ fontSize: 12, color: '#DC2626', margin: '5px 0 0' }}
                    >
                      {errors.precioCompra}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <label htmlFor="precioConsig" style={labelStyle}>
                    Precio acordado consignación ($) *
                  </label>
                  <MoneyInput
                    {...fieldProps('precioConsig')}
                    className="cw-input"
                    value={precioConsig}
                    onChange={v => {
                      setPrecioConsig(v)
                      limpiarError('precioConsig')
                    }}
                    onBlur={() => validarEnBlur('precioConsig')}
                    placeholder="0"
                  />
                  {errors.precioConsig && (
                    <p
                      id="precioConsig-error"
                      style={{ fontSize: 12, color: '#DC2626', margin: '5px 0 0' }}
                    >
                      {errors.precioConsig}
                    </p>
                  )}
                </>
              )}

              <label htmlFor="formaPago" style={labelStyle}>
                Forma de pago
              </label>
              <select
                {...fieldProps('formaPago')}
                className="cw-input"
                value={formaPago}
                onChange={e => setFormaPago(e.target.value)}
              >
                <option>Efectivo</option>
                <option>Transferencia</option>
                <option>Mixto</option>
                <option>Pendiente</option>
              </select>
            </fieldset>
          )}

          {step === 4 && (
            <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend style={{ fontSize: 15, fontWeight: 800, color: '#181B2E', marginBottom: 2 }}>
                ¿Necesita arreglo antes de venderlo?
              </legend>
              <div
                className="cw-radio-grid"
                role="radiogroup"
                aria-label="¿Necesita reparación?"
              >
                {['No', 'Sí'].map(op => (
                  <button
                    key={op}
                    type="button"
                    role="radio"
                    aria-checked={reparacion === op}
                    onClick={() => {
                      setReparacion(op)
                      if (op === 'Sí' && !precioVenta && precioListaMatch > 0) {
                        setPrecioVenta(formatMilesInput(String(precioListaMatch)))
                      }
                    }}
                    style={{
                      padding: '13px 10px',
                      borderRadius: 10,
                      cursor: 'pointer',
                      fontSize: 13.5,
                      fontWeight: 700,
                      border: reparacion === op ? '2px solid #FF6B2C' : '1.5px solid #E6E7F0',
                      background: reparacion === op ? '#FFF1E8' : '#FBFBFD',
                      color: reparacion === op ? '#E85A17' : '#64748B',
                      transition: 'border-color .15s, background .15s',
                    }}
                  >
                    {op}
                  </button>
                ))}
              </div>
              {reparacion === 'Sí' && (
                <div className="cw-grid" style={{ marginTop: 14 }}>
                  <div>
                    <label htmlFor="costoRep" style={{ ...labelStyle, marginTop: 0 }}>
                      Costo reparación ($)
                    </label>
                    <MoneyInput
                      {...fieldProps('costoRep')}
                      className="cw-input"
                      value={costoRep}
                      onChange={v => {
                        setCostoRep(v)
                        limpiarError('costoRep')
                      }}
                      onBlur={() => validarEnBlur('costoRep')}
                      placeholder="0"
                    />
                    {errors.costoRep && (
                      <p id="costoRep-error" style={{ fontSize: 12, color: '#DC2626', margin: '5px 0 0' }}>
                        {errors.costoRep}
                      </p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="precioVenta" style={{ ...labelStyle, marginTop: 0 }}>
                      Precio estimado venta ($)
                    </label>
                    <MoneyInput
                      {...fieldProps('precioVenta')}
                      className="cw-input"
                      value={precioVenta}
                      onChange={v => {
                        setPrecioVenta(v)
                        limpiarError('precioVenta')
                      }}
                      onBlur={() => validarEnBlur('precioVenta')}
                      placeholder="0"
                    />
                    {errors.precioVenta ? (
                      <p id="precioVenta-error" style={{ fontSize: 12, color: '#DC2626', margin: '5px 0 0' }}>
                        {errors.precioVenta}
                      </p>
                    ) : precioListaMatch > 0 ? (
                      <p style={{ fontSize: 11, color: '#94A3B8', margin: '5px 0 0' }}>
                        Lista de Precios: {fmt(precioListaMatch)} · podés editarlo
                      </p>
                    ) : null}
                  </div>
                </div>
              )}
              {estadoFisico === 'Para Reparación' && reparacion === 'No' && (
                <p
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    color: '#B45309',
                    background: '#FFF8EB',
                    border: '1px solid #FDE9BE',
                    borderRadius: 8,
                    padding: '9px 12px',
                    marginTop: 12,
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 16 }}
                    aria-hidden="true"
                  >
                    info
                  </span>
                  El equipo fue marcado como “Para Reparación” en el paso 2.
                </p>
              )}
              {reparacion === 'Sí' && (
                <p
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    color: '#0369A1',
                    background: '#F0F9FF',
                    border: '1px solid #BAE6FD',
                    borderRadius: 8,
                    padding: '9px 12px',
                    marginTop: 12,
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 16 }}
                    aria-hidden="true"
                  >
                    info
                  </span>
                  El equipo entrará a stock con disponibilidad 0 hasta marcarlo como listo en admin/productos.
                </p>
              )}
            </fieldset>
          )}

          {step === 5 && (
            <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend style={{ fontSize: 15, fontWeight: 800, color: '#181B2E', marginBottom: 2 }}>
                ¿Es para una preventa ya pactada?
              </legend>
              <div
                className="cw-radio-grid"
                role="radiogroup"
                aria-label="¿Es para una preventa?"
              >
                {['No', 'Si'].map(op => (
                  <button
                    key={op}
                    type="button"
                    role="radio"
                    aria-checked={esPreventa === op}
                    onClick={() => setEsPreventa(op)}
                    style={{
                      padding: '13px 10px',
                      borderRadius: 10,
                      cursor: 'pointer',
                      fontSize: 13.5,
                      fontWeight: 700,
                      border: esPreventa === op ? '2px solid #FF6B2C' : '1.5px solid #E6E7F0',
                      background: esPreventa === op ? '#FFF1E8' : '#FBFBFD',
                      color: esPreventa === op ? '#E85A17' : '#64748B',
                      transition: 'border-color .15s, background .15s',
                    }}
                  >
                    {op}
                  </button>
                ))}
              </div>
              {esPreventa === 'Si' && (
                <div
                  style={{
                    background: '#EEF3FE',
                    borderLeft: '4px solid #2563EB',
                    borderRadius: 8,
                    padding: 14,
                    marginTop: 14,
                  }}
                >
                  <label htmlFor="nPre" style={{ ...labelStyle, marginTop: 0 }}>
                    Preventa asociada *
                  </label>
                  <select
                    {...fieldProps('nPre')}
                    className="cw-input"
                    value={nPre}
                    onChange={e => {
                      setNPre(e.target.value)
                      limpiarError('nPre')
                    }}
                    onBlur={() => validarEnBlur('nPre')}
                  >
                    <option value="">Seleccionar...</option>
                    {preventas.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.code} — {p.productModelName || ''} → {p.clientName}
                      </option>
                    ))}
                  </select>
                  {errors.nPre && (
                    <p
                      id="nPre-error"
                      style={{ fontSize: 12, color: '#DC2626', margin: '5px 0 0' }}
                    >
                      {errors.nPre}
                    </p>
                  )}
                </div>
              )}
              {esPreventa === 'Si' && (
                <p
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    color: '#0369A1',
                    background: '#F0F9FF',
                    border: '1px solid #BAE6FD',
                    borderRadius: 8,
                    padding: '9px 12px',
                    marginTop: 12,
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 16 }}
                    aria-hidden="true"
                  >
                    info
                  </span>
                  El equipo no sumará stock (quedarà reservado). Cobra y entrega en "Entregar preventa".
                </p>
              )}
            </fieldset>
          )}

          {step === 6 && (
            <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend style={{ fontSize: 15, fontWeight: 800, color: '#181B2E', marginBottom: 2 }}>
                Observaciones y confirmación
              </legend>
              <label htmlFor="obs" style={{ ...labelStyle, marginTop: 12 }}>
                Observaciones
              </label>
              <textarea
                {...fieldProps('obs')}
                className="cw-input"
                style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }}
                value={obs}
                onChange={e => setObs(e.target.value)}
                placeholder="Detalles adicionales del equipo, acuerdo con el proveedor, etc."
              />

              <dl
                style={{
                  margin: '18px 0 0',
                  background: '#FAFBFD',
                  border: '1px solid #EDF0F6',
                  borderRadius: 10,
                  padding: '6px 16px',
                }}
              >
                {resumen.map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 16,
                      padding: '7px 0',
                      borderBottom: '1px solid #EFF1F6',
                    }}
                  >
                    <dt style={{ fontSize: 12, color: '#6B7280', margin: 0, flexShrink: 0 }}>
                      {k}
                    </dt>
                    <dd
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: '#181B2E',
                        margin: 0,
                        textAlign: 'right',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
            </fieldset>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            {step > 1 && (
              <button
                type="button"
                className="cw-btn cw-back"
                onClick={() => irAPaso(step - 1)}
                disabled={sending}
                style={{
                  padding: '12px 20px',
                  border: '1.5px solid #E6E7F0',
                  borderRadius: 10,
                  background: '#fff',
                  color: '#3D4356',
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 17 }}
                  aria-hidden="true"
                >
                  arrow_back
                </span>
                Volver
              </button>
            )}
            <button
              type="submit"
              className="cw-btn cw-primary"
              disabled={sending}
              style={{
                flex: 1,
                background: sending ? '#FFB48C' : 'linear-gradient(135deg,#FF6B2C,#FF8A50)',
                color: '#fff',
                padding: 12,
                border: 'none',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                cursor: sending ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'filter .15s, background .15s',
              }}
            >
              {sending ? (
                <>
                  <span
                    className="material-symbols-outlined cw-spin"
                    style={{ fontSize: 18 }}
                    aria-hidden="true"
                  >
                    progress_activity
                  </span>
                  Registrando…
                </>
              ) : step < TOTAL ? (
                <>
                  Continuar
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 17 }}
                    aria-hidden="true"
                  >
                    arrow_forward
                  </span>
                </>
              ) : (
                <>
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 18 }}
                    aria-hidden="true"
                  >
                    check_circle
                  </span>
                  Registrar compra
                </>
              )}
            </button>
          </div>
          <p style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', margin: '12px 0 0' }}>
            Podés volver a los pasos anteriores con el menú superior para corregir cualquier dato.
          </p>
        </form>
      </div>
    </>
  )
}
