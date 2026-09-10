/**
 * Numeración correlativa de operaciones (ERP §2.6 regla 9).
 *
 * "Los números de operación son correlativos únicos con prefijo configurable y
 *  numeración secuencial; no requieren un contador persistido — se calculan a
 *  partir de la primera fila libre de la hoja."
 *
 * Acá el equivalente de "primera fila libre" es contar las filas que ya tienen
 * ese prefijo. Para que dos operaciones simultáneas no tomen el mismo número se
 * toma un advisory lock transaccional con clave por prefijo: se libera solo al
 * cerrar (commit/rollback) la transacción, así que `nextCorrelativo` DEBE
 * llamarse dentro de una `prisma.$transaction`.
 */

export interface TxClient {
  $executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<number>
}

// Prisma genera un tipo de delegado distinto por modelo, todos con `count` y
// `findMany` pero con firmas sobrecargadas que no encajan en una interfaz
// estrecha. Se acepta cualquier cosa con esos dos métodos.
export interface Delegate {
  count: (args: any) => Promise<number>
  findMany: (args: any) => Promise<any[]>
}

interface Opts {
  /** dígitos mínimos con ceros a la izquierda (default 4) */
  pad?: number
  /** columna donde vive el número (default 'code') */
  field?: string
  /**
   * `true` cuando varias filas comparten el mismo número (compra multilínea,
   * gasto con varios medios): se cuentan valores distintos de `field`, no filas.
   */
  distinct?: boolean
  /** filtro extra para acotar la "hoja" (p. ej. `{ source: 'GASTO' }`) */
  extraWhere?: Record<string, unknown>
}

/**
 * Devuelve el próximo número: `PREFIX-0001`, `PREFIX-0002`, …
 *
 * @param tx        cliente de transacción de Prisma (el de `$transaction`)
 * @param prefix    prefijo sin guión: 'VTA', 'CMP', 'REP', 'CAC', 'GST', …
 * @param delegate  el modelo a contar dentro de la misma transacción
 */
export async function nextCorrelativo(
  tx: TxClient & Record<string, unknown>,
  prefix: string,
  delegate: Delegate,
  opts: Opts = {},
): Promise<string> {
  const { pad = 4, field = 'code', distinct = false, extraWhere = {} } = opts
  // hashtext() -> int4; la clave del lock es estable por prefijo.
  // $executeRaw (no $queryRaw): pg_advisory_xact_lock devuelve void y Prisma
  // no sabe deserializar esa columna en $queryRaw.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`correlativo:${prefix}`}))`
  const where = { ...extraWhere, [field]: { startsWith: `${prefix}-` } }
  const n = distinct
    ? (await delegate.findMany({ where, distinct: [field], select: { [field]: true } })).length
    : await delegate.count({ where })
  return `${prefix}-${String(n + 1).padStart(pad, '0')}`
}
