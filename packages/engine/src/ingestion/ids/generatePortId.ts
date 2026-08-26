/**
 * Generates a deterministic Rycon port ID based on the source identifier.
 * Follows the Identifier Policy (RYCON_SPEC.md §5).
 * Format: 19WPI-[sourceId] (e.g., 19WPI-12345)
 */
export function generatePortId(sourceId: string): string {
  if (!sourceId || sourceId.trim() === '') {
    throw new Error('sourceId must be non-empty to generate a port ID');
  }
  return `19WPI-${sourceId.trim()}`;
}
