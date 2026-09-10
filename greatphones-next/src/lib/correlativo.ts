/**
 * Numeración correlativa de operaciones (ERP §2.6 regla 9).
 *
 * "Los números de operación son correlativos únicos con prefijo configurable y
 *  numeración secuencial; no requieren un contador persistido — se calculan a
 *  partir de la primera fila libre de la hoja."
 *
 * Acá el equivalente de "primera fila libre" es `count(*)` de las filas que ya
 * tienen ese prefijo. Para que dos operaciones simultáneas no tomen el mismo
 * número, se toma un advisory lock transaccional con clave por prefijo: se
 * libera solo al cerrar (commit/rollback) la transacción, así que
 * `nextCorrelativo` DEBE llamarse dentro de una `prisma.$transaction`.
 */

export interface CountDelegate {
  count: (args: { where: { code: { startsWith: string } } }) => Promise<number>
}

export interface TxClient {
  $executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<number>
}

/**
 * Devuelve el próximo número: `PREFIX-0001`, `PREFIX-0002`, …
 *
 * @param tx        cliente de transacción de Prisma (el de `$transaction`)
 * @param prefix    prefijo sin guión: 'VTA', 'CMP', 'REP', 'CAC', …
 * @param delegate  el modelo a contar dentro de la misma transacción (`tx.sale`, `tx.repair`, …)
 * @param pad       dígitos mínimos con ceros a la izquierda (default 4)
 */
export async function nextCorrelativo(
  tx: TxClient & Record<string, unknown>,
  prefix: string,
  delegate: CountDelegate,
  pad = 4,
): Promise<string> {
  // hashtext() -> int4; la clave del lock es estable por prefijo.
  // $executeRaw (no $queryRaw): pg_advisory_xact_lock devuelve void y Prisma
  // no sabe deserializar esa columna en $queryRaw.
  const key = `correlativo:${prefix}`
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`
  const n = await delegate.count({ where: { code: { startsWith: `${prefix}-` } } })
  return `${prefix}-${String(n + 1).padStart(pad, '0')}`
}
