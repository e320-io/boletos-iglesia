'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Registro, GastoEvento, IngresoEvento } from '@/types';

const COMISION_TARJETA = 0.035 * 1.16;
const COMISION_STRIPE = 0.036 * 1.16;

const METODOS = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'otro', label: 'Otro' },
] as const;

function fmt(n: number) {
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Props {
  registros: Registro[];
  eventoId: string;
  eventoNombre: string;
}

export default function EstadoFinanciero({ registros, eventoId, eventoNombre }: Props) {
  const [gastos, setGastos] = useState<GastoEvento[]>([]);
  const [ingresos, setIngresos] = useState<IngresoEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form state — gastos
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState('');
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'transferencia' | 'tarjeta' | 'otro'>('efectivo');
  const [fecha, setFecha] = useState('');
  const [notas, setNotas] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Form state — ingresos adicionales
  const [iConcepto, setIConcepto] = useState('');
  const [iMonto, setIMonto] = useState('');
  const [iMetodoPago, setIMetodoPago] = useState<'efectivo' | 'transferencia' | 'tarjeta' | 'otro'>('efectivo');
  const [iFecha, setIFecha] = useState('');
  const [iNotas, setINotas] = useState('');
  const [showIngresoForm, setShowIngresoForm] = useState(false);
  const [savingIngreso, setSavingIngreso] = useState(false);

  const fetchGastos = useCallback(async () => {
    setLoading(true);
    try {
      const [resG, resI] = await Promise.all([
        fetch(`/api/gastos?evento_id=${eventoId}`),
        fetch(`/api/ingresos?evento_id=${eventoId}`),
      ]);
      const dataG = await resG.json();
      const dataI = await resI.json();
      if (dataG.gastos) setGastos(dataG.gastos);
      if (dataI.ingresos) setIngresos(dataI.ingresos);
    } catch {
      setError('Error al cargar datos financieros');
    } finally {
      setLoading(false);
    }
  }, [eventoId]);

  useEffect(() => {
    fetchGastos();
  }, [fetchGastos]);

  // Compute ingresos from registros pagos (excluye pagos reembolsados: ese dinero ya no está recaudado)
  const allPagosConReembolsos = registros.flatMap(r => r.pagos ?? []);
  const allPagos = allPagosConReembolsos.filter(p => !p.reembolsado);
  const pagosReembolsados = allPagosConReembolsos.filter(p => p.reembolsado);

  const totalReembolsado = pagosReembolsados.reduce((s, p) => s + Number(p.monto_reembolsado), 0);
  const reembolsoPorMetodo = {
    efectivo: pagosReembolsados.filter(p => p.metodo_pago === 'efectivo').reduce((s, p) => s + Number(p.monto_reembolsado), 0),
    transferencia: pagosReembolsados.filter(p => p.metodo_pago === 'transferencia').reduce((s, p) => s + Number(p.monto_reembolsado), 0),
    tarjeta: pagosReembolsados.filter(p => p.metodo_pago === 'tarjeta').reduce((s, p) => s + Number(p.monto_reembolsado), 0),
    stripe: pagosReembolsados.filter(p => (p.metodo_pago as string) === 'stripe').reduce((s, p) => s + Number(p.monto_reembolsado), 0),
    otro: pagosReembolsados.filter(p => p.metodo_pago === 'otro').reduce((s, p) => s + Number(p.monto_reembolsado), 0),
  };

  const totalEfectivo = allPagos.filter(p => p.metodo_pago === 'efectivo').reduce((s, p) => s + Number(p.monto), 0);
  const totalTransferencia = allPagos.filter(p => p.metodo_pago === 'transferencia').reduce((s, p) => s + Number(p.monto), 0);
  const totalTarjetaBruto = allPagos.filter(p => p.metodo_pago === 'tarjeta').reduce((s, p) => s + Number(p.monto), 0);
  const totalStripeBruto = allPagos.filter(p => (p.metodo_pago as string) === 'stripe').reduce((s, p) => s + Number(p.monto), 0);
  const totalOtro = allPagos.filter(p => p.metodo_pago === 'otro').reduce((s, p) => s + Number(p.monto), 0);

  const comisionTarjeta = totalTarjetaBruto * COMISION_TARJETA;
  const netoTarjeta = totalTarjetaBruto - comisionTarjeta;
  const comisionStripe = totalStripeBruto * COMISION_STRIPE;
  const netoStripe = totalStripeBruto - comisionStripe;

  const totalIngresosBoletos = totalEfectivo + netoTarjeta + netoStripe + totalTransferencia + totalOtro;

  // Ingresos adicionales (ofrendas, merch, etc.). Tarjeta neta de comisión, igual que boletos.
  const ingEfectivo = ingresos.filter(i => i.metodo_pago === 'efectivo').reduce((s, i) => s + Number(i.monto), 0);
  const ingTransferencia = ingresos.filter(i => i.metodo_pago === 'transferencia').reduce((s, i) => s + Number(i.monto), 0);
  const ingTarjetaBruto = ingresos.filter(i => i.metodo_pago === 'tarjeta').reduce((s, i) => s + Number(i.monto), 0);
  const ingOtro = ingresos.filter(i => i.metodo_pago === 'otro').reduce((s, i) => s + Number(i.monto), 0);
  const ingComisionTarjeta = ingTarjetaBruto * COMISION_TARJETA;
  const ingNetoTarjeta = ingTarjetaBruto - ingComisionTarjeta;
  const totalIngresosExtra = ingEfectivo + ingNetoTarjeta + ingTransferencia + ingOtro;

  const ingresosPorMetodo = {
    efectivo: ingEfectivo,
    transferencia: ingTransferencia,
    tarjeta: ingNetoTarjeta,
    otro: ingOtro,
  };

  const totalIngresos = totalIngresosBoletos + totalIngresosExtra;

  // Gastos totals
  const totalGastos = gastos.reduce((s, g) => s + Number(g.monto), 0);
  const gastosPorMetodo = {
    efectivo: gastos.filter(g => g.metodo_pago === 'efectivo').reduce((s, g) => s + Number(g.monto), 0),
    transferencia: gastos.filter(g => g.metodo_pago === 'transferencia').reduce((s, g) => s + Number(g.monto), 0),
    tarjeta: gastos.filter(g => g.metodo_pago === 'tarjeta').reduce((s, g) => s + Number(g.monto), 0),
    otro: gastos.filter(g => g.metodo_pago === 'otro').reduce((s, g) => s + Number(g.monto), 0),
  };

  const balance = totalIngresos - totalGastos;

  async function handleAddGasto(e: React.FormEvent) {
    e.preventDefault();
    const montoNum = parseFloat(monto);
    if (!concepto.trim() || isNaN(montoNum) || montoNum <= 0) {
      setError('Concepto y monto válido son requeridos');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/gastos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evento_id: eventoId, concepto: concepto.trim(), monto: montoNum, metodo_pago: metodoPago, fecha: fecha || null, notas: notas.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGastos(prev => [data.gasto, ...prev]);
      setConcepto('');
      setMonto('');
      setFecha('');
      setNotas('');
      setMetodoPago('efectivo');
      setShowForm(false);
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este gasto?')) return;
    try {
      const res = await fetch(`/api/gastos?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar');
      setGastos(prev => prev.filter(g => g.id !== id));
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleAddIngreso(e: React.FormEvent) {
    e.preventDefault();
    const montoNum = parseFloat(iMonto);
    if (!iConcepto.trim() || isNaN(montoNum) || montoNum <= 0) {
      setError('Concepto y monto válido son requeridos');
      return;
    }
    setSavingIngreso(true);
    setError('');
    try {
      const res = await fetch('/api/ingresos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evento_id: eventoId, concepto: iConcepto.trim(), monto: montoNum, metodo_pago: iMetodoPago, fecha: iFecha || null, notas: iNotas.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setIngresos(prev => [data.ingreso, ...prev]);
      setIConcepto('');
      setIMonto('');
      setIFecha('');
      setINotas('');
      setIMetodoPago('efectivo');
      setShowIngresoForm(false);
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    } finally {
      setSavingIngreso(false);
    }
  }

  async function handleDeleteIngreso(id: string) {
    if (!confirm('¿Eliminar este ingreso?')) return;
    try {
      const res = await fetch(`/api/ingresos?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar');
      setIngresos(prev => prev.filter(i => i.id !== id));
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleExportPDF() {
    try {
      const jsPDFModule = await import('jspdf');
      const jsPDF = jsPDFModule.default;
      await import('jspdf-autotable');
      const doc = new jsPDF('portrait', 'mm', 'letter');
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const now = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const peso = (n: number) => `$${fmt(n)}`;

      // ── Header ──
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 188, 212);
      doc.text('Estado Financiero', 14, 18);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(eventoNombre || 'Evento', 14, 25);
      doc.text(`Generado: ${now}`, 14, 31);

      // ── KPIs ──
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 185, 129);
      doc.text(`Ingresos netos: ${peso(totalIngresos)}`, 14, 40);
      doc.setTextColor(239, 68, 68);
      doc.text(`Gastos: ${peso(totalGastos)}`, 80, 40);
      doc.setTextColor(balance >= 0 ? 16 : 239, balance >= 0 ? 185 : 68, balance >= 0 ? 129 : 68);
      doc.text(`Balance: ${balance >= 0 ? '+' : ''}${peso(balance)}`, 135, 40);
      doc.setFont('helvetica', 'normal');

      const tableOpts = (startY: number) => ({
        startY,
        theme: 'grid' as const,
        headStyles: { fillColor: [30, 58, 95] as [number, number, number], textColor: [255, 255, 255] as [number, number, number], fontSize: 9, fontStyle: 'bold' as const },
        bodyStyles: { fontSize: 8, cellPadding: 2.5 },
        alternateRowStyles: { fillColor: [245, 247, 250] as [number, number, number] },
        didDrawPage: (data: any) => {
          const pageCount = (doc as any).internal.getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.text(`Página ${data.pageNumber} de ${pageCount}`, pageW / 2, pageH - 8, { align: 'center' });
        },
      });

      let currentY = 47;

      const sectionTitle = (title: string) => {
        if (currentY > pageH - 40) { doc.addPage(); currentY = 16; }
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 40, 58);
        doc.text(title, 14, currentY);
        currentY += 4;
      };

      // ── Ingresos por boletos ──
      sectionTitle('Ingresos por boletos');
      const boletosRows: string[][] = [];
      if (totalEfectivo > 0) boletosRows.push(['Efectivo', '—', peso(totalEfectivo)]);
      if (totalTarjetaBruto > 0) boletosRows.push(['Tarjeta', peso(comisionTarjeta), peso(netoTarjeta)]);
      if (totalStripeBruto > 0) boletosRows.push(['Stripe', peso(comisionStripe), peso(netoStripe)]);
      if (totalTransferencia > 0) boletosRows.push(['Transferencia', '—', peso(totalTransferencia)]);
      if (totalOtro > 0) boletosRows.push(['Otro', '—', peso(totalOtro)]);
      boletosRows.push(['Subtotal boletos', '', peso(totalIngresosBoletos)]);
      (doc as any).autoTable({
        ...tableOpts(currentY),
        head: [['Método', 'Comisión', 'Neto']],
        body: boletosRows,
        columnStyles: { 0: { cellWidth: 90 }, 1: { halign: 'right' }, 2: { halign: 'right' } },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.row.index === boletosRows.length - 1) data.cell.styles.fontStyle = 'bold';
        },
      });
      currentY = (doc as any).lastAutoTable.finalY + 8;

      // ── Reembolsos (ya restados arriba, solo informativo) ──
      if (totalReembolsado > 0) {
        sectionTitle('Reembolsos');
        const reembolsoRows: string[][] = [];
        if (reembolsoPorMetodo.efectivo > 0) reembolsoRows.push(['Efectivo', peso(reembolsoPorMetodo.efectivo)]);
        if (reembolsoPorMetodo.tarjeta > 0) reembolsoRows.push(['Tarjeta', peso(reembolsoPorMetodo.tarjeta)]);
        if (reembolsoPorMetodo.stripe > 0) reembolsoRows.push(['Stripe', peso(reembolsoPorMetodo.stripe)]);
        if (reembolsoPorMetodo.transferencia > 0) reembolsoRows.push(['Transferencia', peso(reembolsoPorMetodo.transferencia)]);
        if (reembolsoPorMetodo.otro > 0) reembolsoRows.push(['Otro', peso(reembolsoPorMetodo.otro)]);
        reembolsoRows.push(['Total reembolsado', peso(totalReembolsado)]);
        (doc as any).autoTable({
          ...tableOpts(currentY),
          head: [['Método', 'Monto']],
          body: reembolsoRows,
          columnStyles: { 0: { cellWidth: 90 }, 1: { halign: 'right' } },
          didParseCell: (data: any) => {
            if (data.section === 'body' && data.row.index === reembolsoRows.length - 1) data.cell.styles.fontStyle = 'bold';
          },
        });
        currentY = (doc as any).lastAutoTable.finalY + 8;
      }

      // ── Ingresos adicionales ──
      sectionTitle('Ingresos adicionales');
      if (ingresos.length === 0) {
        doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(120, 120, 120);
        doc.text('Sin ingresos adicionales registrados', 14, currentY + 2);
        currentY += 10;
      } else {
        const ingRows = ingresos.map(i => [
          i.concepto,
          METODOS.find(m => m.value === i.metodo_pago)?.label || i.metodo_pago,
          i.fecha ? new Date(i.fecha + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—',
          peso(Number(i.monto)),
        ]);
        ingRows.push(['Subtotal (neto)', '', '', peso(totalIngresosExtra)]);
        (doc as any).autoTable({
          ...tableOpts(currentY),
          head: [['Concepto', 'Método', 'Fecha', 'Monto']],
          body: ingRows,
          columnStyles: { 0: { cellWidth: 80 }, 3: { halign: 'right' } },
          didParseCell: (data: any) => {
            if (data.section === 'body' && data.row.index === ingRows.length - 1) data.cell.styles.fontStyle = 'bold';
          },
        });
        currentY = (doc as any).lastAutoTable.finalY + 8;
      }

      // ── Gastos ──
      sectionTitle('Gastos del evento');
      if (gastos.length === 0) {
        doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(120, 120, 120);
        doc.text('Sin gastos registrados', 14, currentY + 2);
        currentY += 10;
      } else {
        const gastoRows = gastos.map(g => [
          g.concepto,
          METODOS.find(m => m.value === g.metodo_pago)?.label || g.metodo_pago,
          g.fecha ? new Date(g.fecha + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—',
          peso(Number(g.monto)),
        ]);
        gastoRows.push(['Total gastos', '', '', peso(totalGastos)]);
        (doc as any).autoTable({
          ...tableOpts(currentY),
          head: [['Concepto', 'Método', 'Fecha', 'Monto']],
          body: gastoRows,
          columnStyles: { 0: { cellWidth: 80 }, 3: { halign: 'right' } },
          didParseCell: (data: any) => {
            if (data.section === 'body' && data.row.index === gastoRows.length - 1) data.cell.styles.fontStyle = 'bold';
          },
        });
        currentY = (doc as any).lastAutoTable.finalY + 8;
      }

      // ── Resumen final ──
      if (currentY > pageH - 40) { doc.addPage(); currentY = 16; }
      (doc as any).autoTable({
        ...tableOpts(currentY),
        head: [['Resumen del evento', '']],
        body: [
          ['Ingresos por boletos', `+ ${peso(totalIngresosBoletos)}`],
          ...(totalIngresosExtra > 0 ? [['Ingresos adicionales', `+ ${peso(totalIngresosExtra)}`]] : []),
          ['Gastos', `- ${peso(totalGastos)}`],
          ['Balance final', `${balance >= 0 ? '+' : ''}${peso(balance)}`],
        ],
        columnStyles: { 0: { cellWidth: 120 }, 1: { halign: 'right' } },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.row.index === (totalIngresosExtra > 0 ? 3 : 2)) data.cell.styles.fontStyle = 'bold';
        },
      });

      const fechaSlug = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
      const nombreSlug = (eventoNombre || 'Evento').replace(/\s+/g, '-');
      doc.save(`Estado-Financiero-${nombreSlug}-${fechaSlug}.pdf`);
    } catch (err) {
      console.error(err);
      setError('Error al generar el PDF');
    }
  }

  const metodoBadge: Record<string, string> = {
    efectivo: 'bg-emerald-900/40 text-emerald-300 border-emerald-700',
    transferencia: 'bg-blue-900/40 text-blue-300 border-blue-700',
    tarjeta: 'bg-purple-900/40 text-purple-300 border-purple-700',
    stripe: 'bg-indigo-900/40 text-indigo-300 border-indigo-700',
    otro: 'bg-slate-700/40 text-slate-300 border-slate-600',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Estado Financiero — {eventoNombre}</h2>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Ingresos netos y gastos del evento</p>
        </div>
        <button
          onClick={handleExportPDF}
          className="shrink-0 text-sm px-4 py-2 rounded-lg font-medium transition-all"
          style={{ background: 'var(--color-accent)', color: '#000' }}
        >
          📄 Exportar reporte
        </button>
      </div>

      {/* Balance KPI */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl p-5 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="text-3xl font-bold text-emerald-400" style={{ fontFamily: 'var(--font-display)' }}>${fmt(totalIngresos)}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Total ingresos netos</div>
        </div>
        <div className="rounded-xl p-5 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="text-3xl font-bold text-red-400" style={{ fontFamily: 'var(--font-display)' }}>${fmt(totalGastos)}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Total gastos</div>
        </div>
        <div className="rounded-xl p-5 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className={`text-3xl font-bold ${balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`} style={{ fontFamily: 'var(--font-display)' }}>
            {balance >= 0 ? '+' : ''}{fmt(balance)}
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Balance</div>
        </div>
      </div>

      {/* Ingresos por método */}
      <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <h3 className="font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>Ingresos por boletos</h3>
        <div className="space-y-3">
          {totalEfectivo > 0 && (
            <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${metodoBadge.efectivo}`}>Efectivo</span>
              </div>
              <span className="font-mono font-bold text-emerald-400">${fmt(totalEfectivo)}</span>
            </div>
          )}
          {totalTarjetaBruto > 0 && (
            <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${metodoBadge.tarjeta}`}>Tarjeta</span>
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Bruto: ${fmt(totalTarjetaBruto)} − comisión: ${fmt(comisionTarjeta)}</span>
                </div>
              </div>
              <span className="font-mono font-bold text-purple-400">${fmt(netoTarjeta)}</span>
            </div>
          )}
          {totalStripeBruto > 0 && (
            <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${metodoBadge.stripe}`}>Stripe</span>
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Bruto: ${fmt(totalStripeBruto)} − comisión: ${fmt(comisionStripe)}</span>
                </div>
              </div>
              <span className="font-mono font-bold text-indigo-400">${fmt(netoStripe)}</span>
            </div>
          )}
          {totalTransferencia > 0 && (
            <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${metodoBadge.transferencia}`}>Transferencia</span>
              </div>
              <span className="font-mono font-bold text-blue-400">${fmt(totalTransferencia)}</span>
            </div>
          )}
          {totalOtro > 0 && (
            <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${metodoBadge.otro}`}>Otro</span>
              </div>
              <span className="font-mono font-bold" style={{ color: 'var(--color-text-muted)' }}>${fmt(totalOtro)}</span>
            </div>
          )}
          {allPagos.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Sin pagos registrados</p>
          )}
          <div className="flex items-center justify-between pt-1">
            <span className="font-bold text-sm">Subtotal boletos</span>
            <span className="font-mono font-bold text-emerald-400">${fmt(totalIngresosBoletos)}</span>
          </div>
        </div>
      </div>

      {/* Reembolsos */}
      {totalReembolsado > 0 && (
        <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <h3 className="font-bold mb-1" style={{ fontFamily: 'var(--font-display)' }}>Reembolsos</h3>
          <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>Ya restados de &quot;Ingresos por boletos&quot; arriba — se muestran aquí solo como referencia.</p>
          <div className="space-y-1.5">
            {Object.entries(reembolsoPorMetodo).filter(([, v]) => v > 0).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between text-sm">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${metodoBadge[key]}`}>
                  {METODOS.find(m => m.value === key)?.label || (key === 'stripe' ? 'Stripe' : key)}
                </span>
                <span className="font-mono text-slate-400">− ${fmt(val)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 font-bold">
              <span className="text-sm">Total reembolsado</span>
              <span className="font-mono text-slate-400">− ${fmt(totalReembolsado)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Ingresos adicionales */}
      <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold" style={{ fontFamily: 'var(--font-display)' }}>Ingresos adicionales</h3>
          <button
            onClick={() => setShowIngresoForm(v => !v)}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
            style={{ background: 'var(--color-accent)', color: '#000' }}
          >
            {showIngresoForm ? 'Cancelar' : '+ Agregar ingreso'}
          </button>
        </div>
        <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>Ofrendas, venta de merch y otros ingresos. La tarjeta se registra neta de comisión.</p>

        {showIngresoForm && (
          <form onSubmit={handleAddIngreso} className="mb-5 p-4 rounded-lg space-y-3" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Concepto *</label>
                <input
                  value={iConcepto}
                  onChange={e => setIConcepto(e.target.value)}
                  placeholder="Ej: Ofrenda, venta de merch..."
                  required
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Monto *</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={iMonto}
                  onChange={e => setIMonto(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Método de pago *</label>
                <select
                  value={iMetodoPago}
                  onChange={e => setIMetodoPago(e.target.value as typeof iMetodoPago)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                >
                  {METODOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Fecha (opcional)</label>
                <input
                  type="date"
                  value={iFecha}
                  onChange={e => setIFecha(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Notas (opcional)</label>
                <input
                  value={iNotas}
                  onChange={e => setINotas(e.target.value)}
                  placeholder="Observaciones..."
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                />
              </div>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={savingIngreso}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
              style={{ background: 'var(--color-accent)', color: '#000' }}
            >
              {savingIngreso ? 'Guardando...' : 'Guardar ingreso'}
            </button>
          </form>
        )}

        {loading ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Cargando...</p>
        ) : ingresos.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Sin ingresos adicionales registrados</p>
        ) : (
          <div className="space-y-2">
            {ingresos.map(i => (
              <div key={i.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${metodoBadge[i.metodo_pago]}`}>
                    {METODOS.find(m => m.value === i.metodo_pago)?.label}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{i.concepto}</p>
                    {(i.fecha || i.notas) && (
                      <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                        {i.fecha && new Date(i.fecha + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {i.fecha && i.notas && ' · '}
                        {i.notas}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono font-bold text-emerald-400">${fmt(Number(i.monto))}</span>
                  <button
                    onClick={() => handleDeleteIngreso(i.id)}
                    className="text-xs px-2 py-1 rounded transition-colors hover:text-red-400"
                    style={{ color: 'var(--color-text-muted)' }}
                    title="Eliminar"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}

            {/* Subtotals por método (neto) */}
            <div className="mt-4 pt-4 space-y-1.5 border-t" style={{ borderColor: 'var(--color-border)' }}>
              {Object.entries(ingresosPorMetodo).filter(([, v]) => v > 0).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${metodoBadge[key]}`}>
                      {METODOS.find(m => m.value === key)?.label}
                    </span>
                    {key === 'tarjeta' && ingTarjetaBruto > 0 && (
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Bruto: ${fmt(ingTarjetaBruto)} − comisión: ${fmt(ingComisionTarjeta)}</span>
                    )}
                  </div>
                  <span className="font-mono text-emerald-400">${fmt(val)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 font-bold">
                <span className="text-sm">Subtotal ingresos adicionales</span>
                <span className="font-mono text-emerald-400">${fmt(totalIngresosExtra)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Gastos */}
      <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold" style={{ fontFamily: 'var(--font-display)' }}>Gastos del evento</h3>
          <button
            onClick={() => setShowForm(v => !v)}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
            style={{ background: 'var(--color-accent)', color: '#000' }}
          >
            {showForm ? 'Cancelar' : '+ Agregar gasto'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleAddGasto} className="mb-5 p-4 rounded-lg space-y-3" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Concepto *</label>
                <input
                  value={concepto}
                  onChange={e => setConcepto(e.target.value)}
                  placeholder="Ej: Renta del local, decoración..."
                  required
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Monto *</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={monto}
                  onChange={e => setMonto(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Método de pago *</label>
                <select
                  value={metodoPago}
                  onChange={e => setMetodoPago(e.target.value as typeof metodoPago)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                >
                  {METODOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Fecha (opcional)</label>
                <input
                  type="date"
                  value={fecha}
                  onChange={e => setFecha(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Notas (opcional)</label>
                <input
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  placeholder="Observaciones..."
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                />
              </div>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
              style={{ background: 'var(--color-accent)', color: '#000' }}
            >
              {saving ? 'Guardando...' : 'Guardar gasto'}
            </button>
          </form>
        )}

        {loading ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Cargando...</p>
        ) : gastos.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Sin gastos registrados</p>
        ) : (
          <div className="space-y-2">
            {gastos.map(g => (
              <div key={g.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${metodoBadge[g.metodo_pago]}`}>
                    {METODOS.find(m => m.value === g.metodo_pago)?.label}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{g.concepto}</p>
                    {(g.fecha || g.notas) && (
                      <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                        {g.fecha && new Date(g.fecha + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {g.fecha && g.notas && ' · '}
                        {g.notas}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono font-bold text-red-400">${fmt(Number(g.monto))}</span>
                  <button
                    onClick={() => handleDelete(g.id)}
                    className="text-xs px-2 py-1 rounded transition-colors hover:text-red-400"
                    style={{ color: 'var(--color-text-muted)' }}
                    title="Eliminar"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}

            {/* Subtotals por método */}
            <div className="mt-4 pt-4 space-y-1.5 border-t" style={{ borderColor: 'var(--color-border)' }}>
              {Object.entries(gastosPorMetodo).filter(([, v]) => v > 0).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${metodoBadge[key]}`}>
                      {METODOS.find(m => m.value === key)?.label}
                    </span>
                  </div>
                  <span className="font-mono text-red-400">${fmt(val)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 font-bold">
                <span className="text-sm">Total gastos</span>
                <span className="font-mono text-red-400">${fmt(totalGastos)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Resumen final */}
      <div className="rounded-xl p-6 border" style={{ background: balance >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', borderColor: balance >= 0 ? '#10b981' : '#ef4444' }}>
        <h3 className="font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>Resumen del evento</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span style={{ color: 'var(--color-text-muted)' }}>Ingresos por boletos</span>
            <span className="font-mono font-bold text-emerald-400">+ ${fmt(totalIngresosBoletos)}</span>
          </div>
          {totalIngresosExtra > 0 && (
            <div className="flex justify-between">
              <span style={{ color: 'var(--color-text-muted)' }}>Ingresos adicionales</span>
              <span className="font-mono font-bold text-emerald-400">+ ${fmt(totalIngresosExtra)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span style={{ color: 'var(--color-text-muted)' }}>Gastos</span>
            <span className="font-mono font-bold text-red-400">− ${fmt(totalGastos)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t text-base font-bold" style={{ borderColor: 'var(--color-border)' }}>
            <span>Balance final</span>
            <span className={`font-mono ${balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {balance >= 0 ? '+' : ''}{fmt(balance)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
