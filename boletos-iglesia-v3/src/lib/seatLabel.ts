/** Returns the human-readable label for a seat (e.g. "A1", "RE-5"). */
export function seatLabel(a: { fila?: string | null; columna?: number | null; id?: string }): string {
  if (!a.fila || a.columna == null) return a.id ?? '';
  if (a.fila === 'RE') return `RE-${a.columna}`;
  return `${a.fila}${a.columna}`;
}
