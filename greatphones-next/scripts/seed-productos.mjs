/**
 * Genera un catálogo de demostración para dejar la tienda "llena de punta a
 * punta": productos (iPhone + Mac/iPad derivados de la Lista de Precios),
 * accesorios, ofertas y algunos modelos en preventa.
 *
 * NO es data del ERP — es catálogo de vidriera para la inauguración. El stock
 * real se carga después con "Registrar Compra".
 *
 * Idempotente: si ya hay > 20 productos no vuelve a generar (salvo --force).
 * Uso:  node scripts/seed-productos.mjs [--force]
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2, connectionTimeoutMillis: 8000 })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const FORCE = process.argv.includes('--force')

// ── PRNG determinístico (mismo catálogo en cada corrida) ────────────────────
let _seed = 20260910
const rnd = () => {
  _seed = (_seed * 1103515245 + 12345) & 0x7fffffff
  return _seed / 0x7fffffff
}
const pick = arr => arr[Math.floor(rnd() * arr.length)]
const between = (a, b) => a + Math.floor(rnd() * (b - a + 1))

// ── Specs por familia de iPhone ────────────────────────────────────────────
function specsIphone(modelo) {
  const m = modelo.toLowerCase()
  const base = { processor: 'A-series', ram: '4 GB', screen: 6.1, battery: between(84, 100) }
  if (m.includes('8 plus')) return { ...base, processor: 'A11 Bionic', ram: '3 GB', screen: 5.5 }
  if (m.includes('iphone 8')) return { ...base, processor: 'A11 Bionic', ram: '2 GB', screen: 4.7 }
  if (m.includes('xr')) return { ...base, processor: 'A12 Bionic', ram: '3 GB', screen: 6.1 }
  if (m.includes('xs max')) return { ...base, processor: 'A12 Bionic', ram: '4 GB', screen: 6.5 }
  if (m.includes('iphone x')) return { ...base, processor: 'A12 Bionic', ram: '4 GB', screen: 5.8 }
  if (m.includes('11 pro max')) return { ...base, processor: 'A13 Bionic', ram: '4 GB', screen: 6.5 }
  if (m.includes('11 pro')) return { ...base, processor: 'A13 Bionic', ram: '4 GB', screen: 5.8 }
  if (m.includes('iphone 11')) return { ...base, processor: 'A13 Bionic', ram: '4 GB', screen: 6.1 }
  if (m.includes('12 mini')) return { ...base, processor: 'A14 Bionic', ram: '4 GB', screen: 5.4 }
  if (m.includes('12 pro max')) return { ...base, processor: 'A14 Bionic', ram: '6 GB', screen: 6.7 }
  if (m.includes('12 pro')) return { ...base, processor: 'A14 Bionic', ram: '6 GB', screen: 6.1 }
  if (m.includes('iphone 12')) return { ...base, processor: 'A14 Bionic', ram: '4 GB', screen: 6.1 }
  if (m.includes('13 mini')) return { ...base, processor: 'A15 Bionic', ram: '4 GB', screen: 5.4 }
  if (m.includes('13 pro max')) return { ...base, processor: 'A15 Bionic', ram: '6 GB', screen: 6.7 }
  if (m.includes('13 pro')) return { ...base, processor: 'A15 Bionic', ram: '6 GB', screen: 6.1 }
  if (m.includes('iphone 13')) return { ...base, processor: 'A15 Bionic', ram: '4 GB', screen: 6.1 }
  if (m.includes('14 plus')) return { ...base, processor: 'A15 Bionic', ram: '6 GB', screen: 6.7 }
  if (m.includes('14 pro max')) return { ...base, processor: 'A16 Bionic', ram: '6 GB', screen: 6.7 }
  if (m.includes('14 pro')) return { ...base, processor: 'A16 Bionic', ram: '6 GB', screen: 6.1 }
  if (m.includes('iphone 14')) return { ...base, processor: 'A15 Bionic', ram: '6 GB', screen: 6.1 }
  if (m.includes('15 plus')) return { ...base, processor: 'A16 Bionic', ram: '6 GB', screen: 6.7 }
  if (m.includes('15 pro max')) return { ...base, processor: 'A17 Pro', ram: '8 GB', screen: 6.7 }
  if (m.includes('15 pro')) return { ...base, processor: 'A17 Pro', ram: '8 GB', screen: 6.1 }
  if (m.includes('iphone 15')) return { ...base, processor: 'A16 Bionic', ram: '6 GB', screen: 6.1 }
  if (m.includes('16 plus')) return { ...base, processor: 'A18', ram: '8 GB', screen: 6.7 }
  if (m.includes('16 pro max')) return { ...base, processor: 'A18 Pro', ram: '8 GB', screen: 6.9 }
  if (m.includes('16 pro')) return { ...base, processor: 'A18 Pro', ram: '8 GB', screen: 6.3 }
  if (m.includes('iphone 16')) return { ...base, processor: 'A18', ram: '8 GB', screen: 6.1 }
  if (m.includes('17 pro max')) return { ...base, processor: 'A19 Pro', ram: '12 GB', screen: 6.9 }
  if (m.includes('17 pro')) return { ...base, processor: 'A19 Pro', ram: '12 GB', screen: 6.3 }
  if (m.includes('iphone 17')) return { ...base, processor: 'A19', ram: '8 GB', screen: 6.3 }
  return base
}

const PREVENTA = ['iPhone 17', 'iPhone 17 Pro', 'iPhone 17 Pro Max']
const COND = ['Impecable', 'Impecable', 'Impecable', 'Muy bueno', 'Muy bueno', 'Excelente', 'Bueno']

function nuevoMasReciente(modelo) {
  return /iphone 1[567]/i.test(modelo)
}

async function genIphones() {
  const rows = await prisma.priceList.findMany({ where: { category: 'CELULAR' }, orderBy: { orden: 'asc' } })
  const data = rows.map(r => {
    const s = specsIphone(r.modelo)
    const esPreventa = PREVENTA.includes(r.modelo)
    const esOferta = !esPreventa && rnd() < 0.16
    const cond = esPreventa ? 'Nuevo' : nuevoMasReciente(r.modelo) && rnd() < 0.3 ? 'Nuevo' : pick(COND)
    const stock = esPreventa ? 0 : between(0, 1) === 0 && rnd() < 0.15 ? 0 : between(1, 7)
    return {
      name: r.modelo,
      ico: '📱',
      imageUrl: r.imageUrl,
      images: r.imageUrl ? [r.imageUrl] : [],
      brand: 'Apple',
      sub: `${r.almacenamiento}${r.colors?.[0] ? ' · ' + r.colors[0] : ''}`,
      condition: cond,
      price: r.precioARS,
      cost: Math.round(r.precioARS * (cond === 'Nuevo' ? 0.9 : 0.8)),
      battery: cond === 'Nuevo' ? 100 : s.battery,
      stock,
      score: between(88, 99),
      color: r.colors?.[0] || null,
      screen: s.screen,
      type: 'celular',
      sold: between(0, 25),
      slug: r.modelo.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + r.almacenamiento.toLowerCase().replace(/[^a-z0-9]+/g, ''),
      discount: esOferta ? between(5, 12) : 0,
      isOffer: esOferta,
      offerStart: esOferta ? new Date() : null,
      offerEnd: esOferta ? new Date(Date.now() + between(7, 21) * 864e5) : null,
      ram: s.ram,
      storage: r.almacenamiento,
      processor: s.processor,
      description: `${r.modelo} ${r.almacenamiento}. Batería ${cond === 'Nuevo' ? '100' : s.battery}%. Estado ${cond.toLowerCase()}. Garantía 12 meses.`,
      modelGroup: r.modelo,
      isPreorder: esPreventa,
      availableFrom: esPreventa ? new Date(Date.now() + between(8, 15) * 864e5) : null,
    }
  })
  await prisma.product.createMany({ data })
  return data.length
}

async function genMacIpad() {
  const rows = await prisma.priceList.findMany({ where: { category: 'MACIPAD' }, orderBy: [{ modelo: 'asc' }, { precioARS: 'asc' }] })
  const vistos = new Set()
  const data = []
  for (const r of rows) {
    if (vistos.has(r.modelo)) continue // 1 por modelo (config más barata)
    vistos.add(r.modelo)
    const esMac = /macbook/i.test(r.modelo)
    const cond = pick(COND)
    const esOferta = rnd() < 0.12
    data.push({
      name: r.modelo,
      ico: esMac ? '💻' : '📱',
      imageUrl: null,
      images: [],
      brand: 'Apple',
      sub: r.almacenamiento,
      condition: cond,
      price: r.precioARS,
      cost: Math.round(r.precioARS * 0.82),
      stock: between(0, 3),
      score: between(88, 98),
      color: esMac ? pick(['Gris espacial', 'Plata', 'Medianoche', 'Blanco estelar']) : pick(['Gris espacial', 'Plata']),
      type: esMac ? 'notebook' : 'tablet',
      sold: between(0, 8),
      slug: r.modelo.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      discount: esOferta ? between(5, 10) : 0,
      isOffer: esOferta,
      offerStart: esOferta ? new Date() : null,
      offerEnd: esOferta ? new Date(Date.now() + between(7, 20) * 864e5) : null,
      storage: r.almacenamiento,
      description: `${r.modelo}. Estado ${cond.toLowerCase()}. Ideal estudio y trabajo. Garantía 6 meses.`,
      modelGroup: r.modelo,
    })
  }
  await prisma.product.createMany({ data })
  return data.length
}

// ── Accesorios ─────────────────────────────────────────────────────────────
const ACC = [
  // Fundas
  ['Funda de silicona', 'Fundas', 'Apple', ['Negro', 'Azul', 'Rosa', 'Verde'], 18000, 30],
  ['Funda transparente MagSafe', 'Fundas', 'Spigen', ['Transparente'], 22000, 40],
  ['Funda rígida antishock', 'Fundas', 'Spigen', ['Negro', 'Grafito'], 15000, 25],
  ['Funda de cuero', 'Fundas', 'Nillkin', ['Marrón', 'Negro'], 26000, 12],
  ['Funda con anillo', 'Fundas', 'Genérica', ['Negro', 'Plata'], 9000, 35],
  // Vidrios
  ['Vidrio templado 9H', 'Templados', 'Genérica', ['Transparente'], 6000, 80],
  ['Vidrio templado Privacy', 'Templados', 'Genérica', ['Negro'], 9500, 30],
  ['Vidrio templado cámara', 'Templados', 'Genérica', ['Transparente'], 4500, 40],
  ['Film hidrogel', 'Templados', 'Genérica', ['Transparente'], 5000, 25],
  // Cargadores
  ['Cargador 20W USB-C', 'Cargadores', 'Apple', [], 22000, 40],
  ['Cargador 30W USB-C', 'Cargadores', 'Apple', [], 32000, 20],
  ['Cargador MagSafe', 'Cargadores', 'Apple', ['Blanco'], 55000, 10],
  ['Cargador de auto 2 puertos', 'Cargadores', 'Baseus', ['Negro'], 14000, 22],
  ['Base de carga inalámbrica 15W', 'Cargadores', 'Baseus', ['Negro'], 24000, 15],
  // Cables
  ['Cable USB-C a USB-C 1m', 'Cables', 'Apple', ['Blanco'], 12000, 50],
  ['Cable USB-C a Lightning 1m', 'Cables', 'Apple', ['Blanco'], 15000, 45],
  ['Cable USB-C a Lightning 2m', 'Cables', 'Baseus', ['Negro'], 13000, 20],
  ['Cable trenzado USB-C 1.5m', 'Cables', 'Baseus', ['Gris'], 9000, 35],
  // Audio
  ['AirPods (3ª gen)', 'Auriculares', 'Apple', ['Blanco'], 260000, 6],
  ['AirPods Pro (2ª gen)', 'Auriculares', 'Apple', ['Blanco'], 380000, 5],
  ['Auriculares in-ear con cable', 'Auriculares', 'Genérica', ['Blanco'], 8000, 30],
  ['Auriculares bluetooth deportivos', 'Auriculares', 'Baseus', ['Negro'], 35000, 12],
  // Energía
  ['Power bank 10.000 mAh', 'Baterías', 'Baseus', ['Negro', 'Blanco'], 38000, 18],
  ['Power bank 20.000 mAh PD', 'Baterías', 'Baseus', ['Negro'], 62000, 10],
  ['Power bank MagSafe 5.000 mAh', 'Baterías', 'Baseus', ['Blanco'], 45000, 8],
  // Otros
  ['Soporte de escritorio aluminio', 'Soportes', 'Genérica', ['Plata'], 16000, 14],
  ['Soporte para auto ventilación', 'Soportes', 'Baseus', ['Negro'], 11000, 20],
  ['Adaptador USB-C a HDMI', 'Adaptadores', 'Baseus', ['Gris'], 28000, 10],
  ['Adaptador USB-C a jack 3.5', 'Adaptadores', 'Apple', ['Blanco'], 9000, 25],
  ['Lápiz óptico para iPad', 'Accesorios iPad', 'Genérica', ['Blanco'], 42000, 8],
  ['Teclado con touchpad para iPad', 'Accesorios iPad', 'Genérica', ['Negro'], 95000, 4],
  ['Pop socket', 'Accesorios', 'Genérica', ['Negro', 'Glitter'], 4000, 40],
  ['Kit de limpieza para pantalla', 'Accesorios', 'Genérica', [], 6500, 15],
]

async function genAccesorios() {
  const data = []
  for (const [name, category, brand, colors, price, stock] of ACC) {
    const esOferta = rnd() < 0.18
    const st = rnd() < 0.1 ? 0 : between(Math.max(1, stock - 10), stock)
    data.push({
      name,
      ico: '🎧',
      category,
      brand,
      color: colors[0] || null,
      price,
      cost: Math.round(price * 0.55),
      lastCost: Math.round(price * 0.55),
      stock: st,
      sold: between(0, 40),
      isActive: true,
      compareAtPrice: esOferta ? Math.round(price * 1.15) : null,
      discount: esOferta ? between(8, 20) : null,
      isOffer: esOferta,
      offerStart: esOferta ? new Date() : null,
      offerEnd: esOferta ? new Date(Date.now() + between(7, 21) * 864e5) : null,
      description: `${name}${brand && brand !== 'Genérica' ? ' — ' + brand : ''}. Compatible con iPhone.`,
    })
  }
  await prisma.accessory.createMany({ data })
  return data.length
}

async function main() {
  const [prodN, accN] = await Promise.all([prisma.product.count(), prisma.accessory.count()])
  if (!FORCE && prodN > 20) {
    console.log(`Ya hay ${prodN} productos y ${accN} accesorios. Usá --force para regenerar.`)
    return
  }
  if (FORCE) {
    await prisma.product.deleteMany({ where: { inventoryItems: { none: {} }, orderItems: { none: {} } } })
    await prisma.accessory.deleteMany({ where: { orderItems: { none: {} }, purchases: { none: {} } } })
    console.log('--force: catálogo previo sin ventas eliminado')
  }
  const a = await genIphones()
  const b = await genMacIpad()
  const c = await genAccesorios()
  console.log(`Generados: ${a} iPhones · ${b} Mac/iPad · ${c} accesorios`)
  const ofertas = await prisma.product.count({ where: { isOffer: true } })
  const preventa = await prisma.product.count({ where: { isPreorder: true } })
  console.log(`  ${ofertas} en oferta · ${preventa} en preventa`)
}

main()
  .catch(e => { console.error(e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
