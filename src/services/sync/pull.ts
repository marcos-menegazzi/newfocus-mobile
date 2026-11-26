import { execute } from '../../db/connection'

export async function clearTables(tables: string[]): Promise<void> {
  if (tables.length === 0) return
  await execute(tables.map((t) => `DELETE FROM ${t};`).join('\n'))
}

export async function pullPaged(
  limit: number,
  fetchPage: (offset: number) => Promise<boolean>,
): Promise<void> {
  let offset = 0
  let hasMore = true
  while (hasMore) {
    hasMore = await fetchPage(offset)
    offset += limit
  }
}
