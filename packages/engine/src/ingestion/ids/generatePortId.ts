/**
 * Generates a deterministic Rycon port ID based on the source identifier.
 * Follows the Identifier Policy (RYCON_SPEC.md §5).
 * Format: 19WPI-[sourceId] (e.g., 19WPI-12345)
 */
export function normalizePortSourceId(sourceId: string): string {
  if (!sourceId || sourceId.trim() === '') {
    throw new Error('sourceId must be non-empty to generate a port ID');
  }
  return sourceId.trim().replace(/\.0+$/, '');
}

export function generatePortId(sourceId: string, qualifier?: string): string {
  const normalizedSourceId = normalizePortSourceId(sourceId);
  const normalizedQualifier = qualifier
    ?.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `19WPI-${normalizedSourceId}${normalizedQualifier ? `-${normalizedQualifier}` : ''}`;
}
