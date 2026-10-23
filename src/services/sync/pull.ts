import { run } from '../../db/connection'

export async function clearTables(tables: string[]): Promise<void> {
  for (const t of tables) {
    await run(`DELETE FROM ${t}`)
  }
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
