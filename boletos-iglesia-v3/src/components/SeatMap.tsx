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

function SeatSection({
  rows,
  cols,
  asientos,
  selectedSeats,
  onSeatClick,
  onOccupiedClick,
  readOnly,
  highlightSeats,
}: {
  rows: string[];
  cols: number[];
  asientos: Asiento[];
  selectedSeats: string[];
  onSeatClick: (seatId: string) => void;
  onOccupiedClick?: (seat: Asiento) => void;
  readOnly?: boolean;
  highlightSeats?: string[];
}) {
  const asientoMap = new Map(asientos.map(a => [`${a.fila}${a.columna}`, a]));

  return (
    <div>
      <div className="flex gap-0.5 mb-1 ml-6 sm:ml-7">
        {cols.map(c => (
          <div key={c} className="w-7 sm:w-[36px] text-center text-[10px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
            {c}
          </div>
        ))}
      </div>
      {rows.map(row => (
        <div key={row} className="flex items-center gap-0.5 mb-0.5">
          <div className="w-6 sm:w-7 text-right text-[10px] sm:text-xs font-bold pr-1" style={{ color: 'var(--color-text-muted)' }}>
            {row}
          </div>
          {cols.map(col => {
            const seat = asientoMap.get(`${row}${col}`);
            if (!seat) return <div key={col} className="w-7 h-6 sm:w-[36px] sm:h-[30px]" />;

            const isSelected = selectedSeats.includes(seat.id);
            const isHighlighted = highlightSeats?.includes(seat.id);
            const canClick = !readOnly && seat.estado === 'disponible';
            const isOccupied = seat.estado === 'ocupado';

            let className = 'seat';
            if (isSelected || isHighlighted) className += ' seat-selected';
            else className += ` seat-${seat.estado}`;

            return (
              <button
                key={col}
                className={className}
                onClick={() => {
                  if (isSelected) onSeatClick(seat.id);
                  else if (canClick) onSeatClick(seat.id);
                  else if (isOccupied && onOccupiedClick) onOccupiedClick(seat);
                }}
                disabled={!canClick && !isSelected && !(isOccupied && onOccupiedClick)}
                style={isOccupied && onOccupiedClick ? { cursor: 'pointer' } : {}}
                title={`${row}${col} — ${isSelected ? 'Seleccionado' : seat.estado}`}
              >
                {row}{col}
              </button>
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

  // allowSelectConferencistas overrides readOnly for the conferencistas section
  const confReadOnly = !allowSelectConferencistas;

  return (
    <div className="overflow-x-auto">
      {/* Escenario */}
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
      <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 sm:justify-center mb-8">
        <SeatSection
          rows={SEAT_LAYOUT.topLeft.rows}
          cols={SEAT_LAYOUT.topLeft.cols}
          asientos={izqAsientos}
          selectedSeats={selectedSeats}
          onSeatClick={onSeatClick}
          readOnly={readOnly}
          onOccupiedClick={onOccupiedClick}
          highlightSeats={highlightSeats}
        />
        <SeatSection
          rows={SEAT_LAYOUT.topRight.rows}
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
      <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 sm:justify-center mb-8">
        <SeatSection
          rows={SEAT_LAYOUT.midLeft.rows}
          cols={SEAT_LAYOUT.midLeft.cols}
          asientos={izqAsientos}
          selectedSeats={selectedSeats}
          onSeatClick={onSeatClick}
          readOnly={readOnly}
          onOccupiedClick={onOccupiedClick}
          highlightSeats={highlightSeats}
        />
        <SeatSection
          rows={SEAT_LAYOUT.midRight.rows}
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
          <div className="hidden sm:block w-[408px] shrink-0" />
          <SeatSection
            rows={SEAT_LAYOUT.bottom.rows}
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
