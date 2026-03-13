'use client';

import { SEAT_LAYOUT } from '@/lib/constants';
import type { Asiento } from '@/types';

interface SeatMapProps {
  asientos: Asiento[];
  selectedSeats: string[];
  onSeatClick: (seatId: string) => void;
  readOnly?: boolean;
  highlightSeats?: string[];
}

function SeatSection({
  rows,
  cols,
  asientos,
  selectedSeats,
  onSeatClick,
  readOnly,
  highlightSeats,
}: {
  rows: string[];
  cols: number[];
  asientos: Asiento[];
  selectedSeats: string[];
  onSeatClick: (seatId: string) => void;
  readOnly?: boolean;
  highlightSeats?: string[];
}) {
  const asientoMap = new Map(asientos.map(a => [a.id, a]));

  return (
    <div>
      {/* Column headers */}
      <div className="flex gap-0.5 mb-1 ml-8">
        {cols.map(c => (
          <div key={c} className="w-[36px] text-center text-[10px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
            {c}
          </div>
        ))}
      </div>
      {/* Rows */}
      {rows.map(row => (
        <div key={row} className="flex items-center gap-0.5 mb-0.5">
          <div className="w-7 text-right text-xs font-bold pr-1" style={{ color: 'var(--color-text-muted)' }}>
            {row}
          </div>
          {cols.map(col => {
            const seatId = `${row}${col}`;
            const seat = asientoMap.get(seatId);
            if (!seat) return <div key={col} className="w-[36px] h-[30px]" />;

            const isSelected = selectedSeats.includes(seatId);
            const isHighlighted = highlightSeats?.includes(seatId);
            const canClick = !readOnly && seat.estado === 'disponible';

            let className = 'seat';
            if (isSelected) {
              className += ' seat-selected';
            } else if (isHighlighted) {
              className += ' seat-selected';
            } else {
              className += ` seat-${seat.estado}`;
            }

            return (
              <button
                key={col}
                className={className}
                onClick={() => {
                  if (isSelected) onSeatClick(seatId);
                  else if (canClick) onSeatClick(seatId);
                }}
                disabled={!canClick && !isSelected}
                title={`${seatId} — ${isSelected ? 'Seleccionado' : seat.estado}`}
              >
                {seatId}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function SeatMap({ asientos, selectedSeats, onSeatClick, readOnly, highlightSeats }: SeatMapProps) {
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

      {/* Conferencistas label */}
      <div className="flex gap-16 justify-center mb-3">
        <span className="text-xs font-medium px-4 py-1 rounded-full border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
          Conferencistas
        </span>
        <span className="text-xs font-medium px-4 py-1 rounded-full border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
          Conferencistas
        </span>
      </div>

      {/* Top Section: A-D */}
      <div className="flex gap-8 justify-center mb-8">
        <SeatSection
          rows={SEAT_LAYOUT.topLeft.rows}
          cols={SEAT_LAYOUT.topLeft.cols}
          asientos={asientos}
          selectedSeats={selectedSeats}
          onSeatClick={onSeatClick}
          readOnly={readOnly}
          highlightSeats={highlightSeats}
        />
        <SeatSection
          rows={SEAT_LAYOUT.topRight.rows}
          cols={SEAT_LAYOUT.topRight.cols}
          asientos={asientos}
          selectedSeats={selectedSeats}
          onSeatClick={onSeatClick}
          readOnly={readOnly}
          highlightSeats={highlightSeats}
        />
      </div>

      {/* Middle Section: E-N */}
      <div className="flex gap-8 justify-center mb-8">
        <SeatSection
          rows={SEAT_LAYOUT.midLeft.rows}
          cols={SEAT_LAYOUT.midLeft.cols}
          asientos={asientos}
          selectedSeats={selectedSeats}
          onSeatClick={onSeatClick}
          readOnly={readOnly}
          highlightSeats={highlightSeats}
        />
        <SeatSection
          rows={SEAT_LAYOUT.midRight.rows}
          cols={SEAT_LAYOUT.midRight.cols}
          asientos={asientos}
          selectedSeats={selectedSeats}
          onSeatClick={onSeatClick}
          readOnly={readOnly}
          highlightSeats={highlightSeats}
        />
      </div>

      {/* Bottom Section: O-S (center only) */}
      <div className="flex justify-center">
        <SeatSection
          rows={SEAT_LAYOUT.bottom.rows}
          cols={SEAT_LAYOUT.bottom.cols}
          asientos={asientos}
          selectedSeats={selectedSeats}
          onSeatClick={onSeatClick}
          readOnly={readOnly}
          highlightSeats={highlightSeats}
        />
      </div>
    </div>
  );
}
