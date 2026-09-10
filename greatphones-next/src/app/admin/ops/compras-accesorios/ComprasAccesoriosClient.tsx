'use client'

import { useEffect, useState } from 'react'
import AdminTopbar from '@/components/AdminTopbar'

const OPERADORES = ['Martin', 'Maca', 'Sam', 'Eva', 'Buda']

interface Linea {
  categoria: string
  producto: string
  marca: string
  color: string
  cantidad: string
  costoUnit: string
  precioVenta: string
}

const nuevaLinea = (): Linea => ({ categoria: '', producto: '', marca: '', color: '', cantidad: '1', costoUnit: '', precioVenta: '' })

function fmt(n: number) {
  return '$' + (n || 0).toLocaleString('es-AR')
}

const input: React.CSSProperties = {
  width: '100%', padding: 8, border: '1.5px solid #E6E7F0', borderRadius: 8, fontSize: 13, background: '#FBFBFD',
}

export default function ComprasAccesoriosClient() {
  const [operador, setOperador] = useState('')
  const [proveedor, setProveedor] = useState('')
  const [lineas, setLineas] = useState<Linea[]>([nuevaLinea()])
  const [efec, setEfec] = useState('')
  const [transf, setTransf] = useState('')
  const [usd, setUsd] = useState('')
  const [categorias, setCategorias] = useState<string[]>([])
  const [ultimas, setUltimas] = useState<any[]>([])
  const [msg, setMsg] = useState<{ t: 'ok' | 'err'; s: string } | null>(null)
  const [enviando, setEnviando] = useState(false)

  const cargar = () => {
    fetch('/api/admin/ops/compras-accesorios', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        setCategorias(d.categorias || [])
        setUltimas(d.ultimas || [])
      })
      .catch(() => {})
  }
  useEffect(cargar, [])

  const setLinea = (i: number, patch: Partial<Linea>) =>
    setLineas(ls => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))

  const costoTotal = lineas.reduce((s, l) => s + (parseInt(l.cantidad) || 0) * (parseInt(l.costoUnit) || 0), 0)
  const pagoTotal = (parseInt(efec) || 0) + (parseInt(transf) || 0)
  const dif = pagoTotal - costoTotal // sin contar USD (se convierte en el server)

  const enviar = async () => {
    setMsg(null)
    const payload = {
      proveedor: proveedor.trim() || undefined,
      operador: operador || undefined,
      efectivo: parseInt(efec) || 0,
      transferencia: parseInt(transf) || 0,
      usd: parseFloat(usd) || 0,
      lineas: lineas
        .filter(l => l.producto.trim() && l.categoria.trim())
        .map(l => ({
          categoria: l.categoria.trim(),
          producto: l.producto.trim(),
          marca: l.marca.trim() || null,
          color: l.color.trim() || null,
          cantidad: parseInt(l.cantidad) || 0,
          costoUnit: parseInt(l.costoUnit) || 0,
          precioVenta: parseInt(l.precioVenta) || null,
        })),
    }
    if (!operador) return setMsg({ t: 'err', s: 'Seleccioná el operador' })
    if (payload.lineas.length === 0) return setMsg({ t: 'err', s: 'Cargá al menos una línea con categoría y producto' })
    setEnviando(true)
    try {
      const r = await fetch('/api/admin/ops/compras-accesorios', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const d = await r.json()
      if (!r.ok) {
        setMsg({ t: 'err', s: d.error || 'Error al registrar la compra' })
        return
      }
      setMsg({ t: 'ok', s: `Compra ${d.code} registrada — ${d.lineas} líneas, ${fmt(d.costoTotal)}` })
      setLineas([nuevaLinea()])
      setEfec(''); setTransf(''); setUsd(''); setProveedor('')
      cargar()
    } catch {
      setMsg({ t: 'err', s: 'Error de conexión' })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <AdminTopbar titulo="Comprar Accesorios" />
      <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
        <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 18px' }}>
          Ingreso de stock de accesorios: costo real, proveedor, y asiento contable. El costo promedio ponderado se actualiza solo.
        </p>

        {msg && (
          <div style={{ padding: '11px 15px', borderRadius: 10, marginBottom: 16, color: '#fff', fontWeight: 600, fontSize: 13, background: msg.t === 'ok' ? '#0F9D58' : '#DC2626' }}>
            {msg.s}
          </div>
        )}

        <div style={{ background: '#fff', border: '1px solid #E6E7F0', borderRadius: 12, padding: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#3D4356' }}>Proveedor</label>
              <input style={input} value={proveedor} onChange={e => setProveedor(e.target.value)} placeholder="Ej: Mayorista Norte" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#3D4356' }}>Operador *</label>
              <select style={input} value={operador} onChange={e => setOperador(e.target.value)}>
                <option value="">Seleccionar…</option>
                {OPERADORES.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>

          <datalist id="cat-list">{categorias.map(c => <option key={c} value={c} />)}</datalist>

          <div style={{ overflowX: 'auto', marginTop: 16 }}>
            <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#6B7280' }}>
                  <th style={{ padding: 6 }}>Categoría</th>
                  <th style={{ padding: 6 }}>Producto</th>
                  <th style={{ padding: 6 }}>Marca</th>
                  <th style={{ padding: 6 }}>Color</th>
                  <th style={{ padding: 6, width: 70 }}>Cant.</th>
                  <th style={{ padding: 6, width: 110 }}>Costo unit.</th>
                  <th style={{ padding: 6, width: 110 }}>P. venta</th>
                  <th style={{ padding: 6, width: 100 }}>Subtotal</th>
                  <th style={{ width: 30 }}></th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((l, i) => (
                  <tr key={i}>
                    <td style={{ padding: 4 }}><input list="cat-list" style={input} value={l.categoria} onChange={e => setLinea(i, { categoria: e.target.value })} /></td>
                    <td style={{ padding: 4 }}><input style={input} value={l.producto} onChange={e => setLinea(i, { producto: e.target.value })} /></td>
                    <td style={{ padding: 4 }}><input style={input} value={l.marca} onChange={e => setLinea(i, { marca: e.target.value })} /></td>
                    <td style={{ padding: 4 }}><input style={input} value={l.color} onChange={e => setLinea(i, { color: e.target.value })} /></td>
                    <td style={{ padding: 4 }}><input type="number" min={1} style={input} value={l.cantidad} onChange={e => setLinea(i, { cantidad: e.target.value })} /></td>
                    <td style={{ padding: 4 }}><input type="number" min={0} style={input} value={l.costoUnit} onChange={e => setLinea(i, { costoUnit: e.target.value })} /></td>
                    <td style={{ padding: 4 }}><input type="number" min={0} style={input} value={l.precioVenta} onChange={e => setLinea(i, { precioVenta: e.target.value })} placeholder="auto" /></td>
                    <td style={{ padding: 6, fontWeight: 600 }}>{fmt((parseInt(l.cantidad) || 0) * (parseInt(l.costoUnit) || 0))}</td>
                    <td style={{ padding: 4 }}>
                      {lineas.length > 1 && (
                        <button onClick={() => setLineas(ls => ls.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 16 }}>×</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={() => setLineas(ls => [...ls, nuevaLinea()])} style={{ marginTop: 8, background: 'none', border: '1px dashed #C7D2FE', borderRadius: 8, padding: '7px 14px', fontSize: 12.5, color: '#4F46E5', cursor: 'pointer' }}>
            + Agregar línea
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginTop: 18 }}>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#3D4356' }}>Pagado efectivo</label><input type="number" style={input} value={efec} onChange={e => setEfec(e.target.value)} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#3D4356' }}>Pagado transferencia</label><input type="number" style={input} value={transf} onChange={e => setTransf(e.target.value)} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#3D4356' }}>Pagado USD</label><input type="number" style={input} value={usd} onChange={e => setUsd(e.target.value)} /></div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontSize: 13 }}>
              Costo total: <strong>{fmt(costoTotal)}</strong>
              {' · '}Pagado (ARS): <strong>{fmt(pagoTotal)}</strong>
              {parseFloat(usd) > 0 && <span style={{ color: '#6B7280' }}> + USD {usd}</span>}
              {dif !== 0 && parseFloat(usd) === 0 && (
                <span style={{ color: '#B45309', marginLeft: 8 }}>{dif > 0 ? 'Pagaste de más' : 'Falta pagar'} {fmt(Math.abs(dif))}</span>
              )}
            </div>
            <button onClick={enviar} disabled={enviando} style={{ background: 'linear-gradient(135deg,#4F46E5,#6366F1)', color: '#fff', border: 'none', padding: '11px 22px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              {enviando ? 'Registrando…' : 'Registrar compra'}
            </button>
          </div>
        </div>

        {ultimas.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: '#181B2E' }}>Últimas compras</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, marginTop: 8 }}>
              <thead><tr style={{ color: '#6B7280', textAlign: 'left' }}><th style={{ padding: 6 }}>N°</th><th style={{ padding: 6 }}>Proveedor</th><th style={{ padding: 6 }}>Producto</th><th style={{ padding: 6 }}>Cant.</th><th style={{ padding: 6 }}>Costo unit.</th><th style={{ padding: 6 }}>Fecha</th></tr></thead>
              <tbody>
                {ultimas.map(u => (
                  <tr key={u.id} style={{ borderTop: '1px solid #EFF1F6' }}>
                    <td style={{ padding: 6, fontWeight: 600 }}>{u.code}</td>
                    <td style={{ padding: 6 }}>{u.proveedor || '—'}</td>
                    <td style={{ padding: 6 }}>{u.producto}</td>
                    <td style={{ padding: 6 }}>{u.cantidad}</td>
                    <td style={{ padding: 6 }}>{fmt(u.costoUnit)}</td>
                    <td style={{ padding: 6 }}>{new Date(u.createdAt).toLocaleDateString('es-AR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
