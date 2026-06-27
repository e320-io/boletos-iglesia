'use client';

import { useState } from 'react';
import { SEAT_LAYOUT, CONF_SEAT_ROWS } from '@/lib/constants';
import { seatLabel } from '@/lib/seatLabel';
import type { Asiento } from '@/types';

interface SeatMapProps {
  asientos: Asiento[];
  selectedSeats: string[];
  onSeatClick: (seatId: string) => void;
  onOccupiedClick?: (seat: Asiento) => void;
  readOnly?: boolean;
  highlightSeats?: string[];
  /** When true, conferencistas seats start expanded and are selectable */
  allowSelectConferencistas?: boolean;
}

/** Single seat button — shared by the grid (3-block) and section layouts. */
function SeatButton({
  seat,
  label,
  selectedSeats,
  onSeatClick,
  onOccupiedClick,
  readOnly,
  highlightSeats,
  allowSelectReservado,
  width,
}: {
  seat: Asiento;
  label: string;
  selectedSeats: string[];
  onSeatClick: (seatId: string) => void;
  onOccupiedClick?: (seat: Asiento) => void;
  readOnly?: boolean;
  highlightSeats?: string[];
  allowSelectReservado?: boolean;
  width?: number;
}) {
  const isSelected = selectedSeats.includes(seat.id);
  const isHighlighted = highlightSeats?.includes(seat.id);
  const canClick = (!readOnly && seat.estado === 'disponible')
    || (allowSelectReservado === true && seat.estado === 'reservado');
  const isOccupied = seat.estado === 'ocupado';

  let className = 'seat';
  if (isSelected || isHighlighted) className += ' seat-selected';
  else className += ` seat-${seat.estado}`;

  return (
    <button
      className={className}
      onClick={() => {
        if (isSelected) onSeatClick(seat.id);
        else if (canClick) onSeatClick(seat.id);
        else if (isOccupied && onOccupiedClick) onOccupiedClick(seat);
      }}
      disabled={!canClick && !isSelected && !(isOccupied && onOccupiedClick)}
      style={{
        ...(width ? { width } : {}),
        ...(isOccupied && onOccupiedClick ? { cursor: 'pointer' } : {}),
      }}
      title={`${label} — ${isSelected ? 'Seleccionado' : seat.estado}`}
    >
      {label}
    </button>
  );
}

function SeatSection({
  rows,
  cols,
  asientos,
  selectedSeats,
  onSeatClick,
  onOccupiedClick,
  readOnly,
  highlightSeats,
  allowSelectReservado,
}: {
  rows: string[];
  cols: number[];
  asientos: Asiento[];
  selectedSeats: string[];
  onSeatClick: (seatId: string) => void;
  onOccupiedClick?: (seat: Asiento) => void;
  readOnly?: boolean;
  highlightSeats?: string[];
  /** When true, 'reservado' seats become selectable (admin/cortesía only) */
  allowSelectReservado?: boolean;
}) {
  const asientoMap = new Map(asientos.map(a => [`${a.fila}${a.columna}`, a]));

  return (
    <div>
      <div className="flex gap-0.5 mb-1 ml-8">
        {cols.map(c => (
          <div key={c} className="w-[36px] text-center text-[10px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
            {c}
          </div>
        ))}
      </div>
      {rows.map(row => (
        <div key={row} className="flex items-center gap-0.5 mb-0.5">
          <div className="w-7 text-right text-xs font-bold pr-1" style={{ color: 'var(--color-text-muted)' }}>
            {row}
          </div>
          {cols.map(col => {
            const seat = asientoMap.get(`${row}${col}`);
            if (!seat) return <div key={col} className="w-[36px] h-[30px]" />;
            return (
              <SeatButton
                key={col}
                seat={seat}
                label={`${row}${col}`}
                selectedSeats={selectedSeats}
                onSeatClick={onSeatClick}
                onOccupiedClick={onOccupiedClick}
                readOnly={readOnly}
                highlightSeats={highlightSeats}
                allowSelectReservado={allowSelectReservado}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ConferencistasSection({
  asientos,
  selectedSeats,
  onSeatClick,
  onOccupiedClick,
  readOnly,
  highlightSeats,
}: {
  asientos: Asiento[];
  selectedSeats: string[];
  onSeatClick: (seatId: string) => void;
  onOccupiedClick?: (seat: Asiento) => void;
  readOnly?: boolean;
  highlightSeats?: string[];
}) {
  const seatsMap = new Map(
    asientos.filter(a => a.seccion === 'conferencistas').map(a => [a.columna, a])
  );

  const renderSeat = (n: number) => {
    const seat = seatsMap.get(n);
    const label = `RE-${n}`;
    if (!seat) return <div key={n} className="w-[44px] h-[30px]" />;

    const isSelected = selectedSeats.includes(seat.id);
    const isHighlighted = highlightSeats?.includes(seat.id);
    const canClick = !readOnly && seat.estado === 'disponible';
    const isOccupied = seat.estado === 'ocupado';

    let className = 'seat';
    if (isSelected || isHighlighted) className += ' seat-selected';
    else className += ` seat-${seat.estado}`;

    return (
      <button
        key={n}
        className={className}
        style={{ width: 44, ...(isOccupied && onOccupiedClick ? { cursor: 'pointer' } : {}) }}
        onClick={() => {
          if (isSelected) onSeatClick(seat.id);
          else if (canClick) onSeatClick(seat.id);
          else if (isOccupied && onOccupiedClick) onOccupiedClick(seat);
        }}
        disabled={!canClick && !isSelected && !(isOccupied && onOccupiedClick)}
        title={`${label} — ${isSelected ? 'Seleccionado' : seat.estado}`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex gap-8 justify-center">
      <div className="space-y-0.5">
        {CONF_SEAT_ROWS.map((row, i) => (
          <div key={i} className="flex gap-0.5">
            {row.left.map(n => renderSeat(n))}
          </div>
        ))}
      </div>
      <div className="space-y-0.5">
        {CONF_SEAT_ROWS.map((row, i) => (
          <div key={i} className="flex gap-0.5">
            {row.right.map(n => renderSeat(n))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SeatMap({ asientos, selectedSeats, onSeatClick, onOccupiedClick, readOnly, highlightSeats, allowSelectConferencistas = false }: SeatMapProps) {
  const [confExpanded, setConfExpanded] = useState(allowSelectConferencistas);

  const confAsientos = asientos.filter(a => a.seccion === 'conferencistas');
  const hasConferencistas = confAsientos.length > 0;
  const confOcupados = confAsientos.filter(a => a.estado === 'ocupado').length;

  // Filter by section to prevent duplicate rendering when rows overlap
  const izqAsientos = asientos.filter(a => a.seccion === 'izquierda');
  const derAsientos = asientos.filter(a => a.seccion === 'derecha');
  const centroAsientos = asientos.filter(a => a.seccion === 'centro');
  const hasCentro = centroAsientos.length > 0;
  // Derive rows dynamically so deleted rows (e.g. Z for legacy-women) disappear automatically
  const bottomRows = Array.from(new Set(centroAsientos.map(a => a.fila))).sort();
  // Derive top (A-D) and middle (E-T) rows per section from the seats that actually
  // exist, so deleted/missing rows leave no empty gap ("huecote") in the map.
  const izqRows = Array.from(new Set(izqAsientos.map(a => a.fila))).sort();
  const derRows = Array.from(new Set(derAsientos.map(a => a.fila))).sort();
  const topLeftRows = izqRows.filter(r => r < 'E');
  const midLeftRows = izqRows.filter(r => r >= 'E');
  const topRightRows = derRows.filter(r => r < 'E');
  const midRightRows = derRows.filter(r => r >= 'E');

  // allowSelectConferencistas overrides readOnly for the conferencistas section
  const confReadOnly = !allowSelectConferencistas;

  // ── Three-block layout (e.g. legacy-varones): izquierda | centro | derecha
  // rendered side by side over the same rows (A–M). Detected when the centro
  // block lives in the front rows (A–T) instead of being the back U–Z block.
  const threeBlock = centroAsientos.length > 0 && centroAsientos.every(a => a.fila < 'U');

  const Escenario = (
    <div className="text-center mb-6">
      <div className="inline-block px-20 py-3 rounded-lg border-2 font-bold text-sm tracking-wider uppercase"
        style={{
          borderColor: 'var(--color-accent)',
          color: 'var(--color-accent)',
          background: 'rgba(0, 188, 212, 0.08)',
          fontFamily: 'var(--font-display)',
        }}>
        Escenario
      </div>
    </div>
  );

  if (threeBlock) {
    // ── legacy-varones geometry ──────────────────────────────────────────
    // 13 physical rows × 16 seats (blocks 6 · 4 · 6). The first RESERVED_ROWS
    // rows are "apartados" (conferencistas/invitados), numbered as their own
    // series RE-1…RE-32. The public seats below them use continuous numbering
    // A1…I16 (left→right across blocks, wrapping rows; letter rolls every
    // PER_LETTER). The canonical label (fila+columna) is stored in the DB, so
    // we recover each seat's physical position (rowIndex, colAcross) from it.
    const PER_ROW = 16;       // seats per physical row (6 + 4 + 6)
    const PER_LETTER = 20;    // public seats per letter (A = 1..20, …)
    const LEFT = 6, CENTER = 4;
    const CELL_W = 44;        // wider to fit "RE-32" labels

    const blockSeats = [...izqAsientos, ...centroAsientos, ...derAsientos];
    // If "apartados" (RE) seats exist they occupy the front rows; the public
    // seats are shifted below them. With no RE seats (plain continuous layout)
    // the shift is 0, so the public block starts at the top with no gap.
    const reSeats = blockSeats.filter(a => a.fila === 'RE');
    const reservedRowCount = reSeats.length
      ? Math.max(...reSeats.map(a => Math.floor((a.columna - 1) / PER_ROW))) + 1
      : 0;

    const grid = new Map<string, Asiento>();
    let maxRow = 0;
    for (const a of blockSeats) {
      let pos: number, rowIndex: number;
      if (a.fila === 'RE') {
        // Apartados: their own RE-1…RE-N series fills the front rows.
        pos = a.columna - 1;
        rowIndex = Math.floor(pos / PER_ROW);
      } else {
        // Public: continuous A1… numbering, placed below any reserved rows.
        pos = (a.fila.charCodeAt(0) - 65) * PER_LETTER + (a.columna - 1);
        rowIndex = Math.floor(pos / PER_ROW) + reservedRowCount;
      }
      const colAcross = pos % PER_ROW;
      grid.set(`${rowIndex}-${colAcross}`, a);
      if (rowIndex > maxRow) maxRow = rowIndex;
    }

    const colRange = (from: number, to: number) =>
      Array.from({ length: to - from }, (_, i) => from + i);
    const cell = (rowIndex: number, colAcross: number) => {
      const seat = grid.get(`${rowIndex}-${colAcross}`);
      if (!seat) return <div key={colAcross} style={{ width: CELL_W, height: 30 }} />;
      return (
        <SeatButton
          key={colAcross}
          seat={seat}
          label={seatLabel(seat)}
          width={CELL_W}
          selectedSeats={selectedSeats}
          onSeatClick={onSeatClick}
          onOccupiedClick={onOccupiedClick}
          readOnly={readOnly}
          highlightSeats={highlightSeats}
          // Apartados (RE) are assignable only in admin/cortesía contexts
          allowSelectReservado={allowSelectConferencistas}
        />
      );
    };

    return (
      <div className="overflow-x-auto">
        {Escenario}
        {reSeats.length > 0 && (
          <p className="text-center text-[11px] mb-4" style={{ color: '#f59e0b' }}>
            ⭐ Filas RE (apartados): reservadas para conferencistas e invitados especiales
          </p>
        )}
        <div className="flex flex-col gap-0.5 items-center" style={{ minWidth: 'fit-content' }}>
          {Array.from({ length: maxRow + 1 }, (_, r) => (
            <div key={r} className="flex gap-0.5">
              <div className="flex gap-0.5">{colRange(0, LEFT).map(c => cell(r, c))}</div>
              <div className="w-6 shrink-0" />
              <div className="flex gap-0.5">{colRange(LEFT, LEFT + CENTER).map(c => cell(r, c))}</div>
              <div className="w-6 shrink-0" />
              <div className="flex gap-0.5">{colRange(LEFT + CENTER, PER_ROW).map(c => cell(r, c))}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      {Escenario}

      {/* Conferencistas: collapsible when seats exist */}
      {hasConferencistas ? (
        <div className="mb-3">
          <div className="flex gap-16 justify-center mb-1">
            {(['Conferencistas', 'Conferencistas'] as const).map((label, i) => (
              <button
                key={i}
                onClick={() => setConfExpanded(v => !v)}
                className="flex items-center gap-1.5 text-xs font-medium px-4 py-1 rounded-full border transition-colors"
                style={confExpanded
                  ? { borderColor: 'rgba(245,158,11,0.6)', color: '#f59e0b', background: 'rgba(245,158,11,0.08)' }
                  : { borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }
                }
              >
                {label}
                {confOcupados > 0 && confExpanded && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white" style={{ background: 'rgba(245,158,11,0.7)' }}>
                    {confOcupados}/{confAsientos.length}
                  </span>
                )}
                <span className="text-[10px]">{confExpanded ? '▲' : '▼'}</span>
              </button>
            ))}
          </div>

          {confExpanded && (
            <div className="rounded-xl p-4 border mb-3" style={{ borderColor: 'rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.04)' }}>
              {allowSelectConferencistas && (
                <p className="text-center text-[11px] mb-3" style={{ color: '#f59e0b' }}>
                  ⭐ Solo Admin — RE-1 a RE-42
                </p>
              )}
              <ConferencistasSection
                asientos={asientos}
                selectedSeats={selectedSeats}
                onSeatClick={onSeatClick}
                readOnly={confReadOnly}
                onOccupiedClick={onOccupiedClick}
                highlightSeats={highlightSeats}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="flex gap-16 justify-center mb-3">
          <span className="text-xs font-medium px-4 py-1 rounded-full border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
            Conferencistas
          </span>
          <span className="text-xs font-medium px-4 py-1 rounded-full border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
            Conferencistas
          </span>
        </div>
      )}

      {/* Top Section: A-D */}
      <div className="flex gap-8 justify-center mb-8">
        <SeatSection
          rows={topLeftRows}
          cols={SEAT_LAYOUT.topLeft.cols}
          asientos={izqAsientos}
          selectedSeats={selectedSeats}
          onSeatClick={onSeatClick}
          readOnly={readOnly}
          onOccupiedClick={onOccupiedClick}
          highlightSeats={highlightSeats}
        />
        <SeatSection
          rows={topRightRows}
          cols={SEAT_LAYOUT.topRight.cols}
          asientos={derAsientos}
          selectedSeats={selectedSeats}
          onSeatClick={onSeatClick}
          readOnly={readOnly}
          onOccupiedClick={onOccupiedClick}
          highlightSeats={highlightSeats}
        />
      </div>

      {/* Middle Section: E-T */}
      <div className="flex gap-8 justify-center mb-8">
        <SeatSection
          rows={midLeftRows}
          cols={SEAT_LAYOUT.midLeft.cols}
          asientos={izqAsientos}
          selectedSeats={selectedSeats}
          onSeatClick={onSeatClick}
          readOnly={readOnly}
          onOccupiedClick={onOccupiedClick}
          highlightSeats={highlightSeats}
        />
        <SeatSection
          rows={midRightRows}
          cols={SEAT_LAYOUT.midRight.cols}
          asientos={derAsientos}
          selectedSeats={selectedSeats}
          onSeatClick={onSeatClick}
          readOnly={readOnly}
          onOccupiedClick={onOccupiedClick}
          highlightSeats={highlightSeats}
        />
      </div>

      {/* Bottom Right Section: U-Z (separate physical block, right-aligned) */}
      {hasCentro && (
        <div className="flex gap-8 justify-center">
          <div className="w-[408px] shrink-0" />
          <SeatSection
            rows={bottomRows}
            cols={SEAT_LAYOUT.bottom.cols}
            asientos={centroAsientos}
            selectedSeats={selectedSeats}
            onSeatClick={onSeatClick}
            readOnly={readOnly}
            onOccupiedClick={onOccupiedClick}
            highlightSeats={highlightSeats}
          />
        </div>
      )}
    </div>
  );
}
