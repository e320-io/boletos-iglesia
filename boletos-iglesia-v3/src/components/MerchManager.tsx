'use client';

import { useState, useEffect, useCallback } from 'react';
import { User } from '@/lib/auth';
import { MerchProducto, MerchVariante, MerchVenta } from '@/types';

interface Props {
  onBack: () => void;
  user: User;
  onOpenPOS: () => void;
}

type Tab = 'productos' | 'inventario' | 'finanzas';

const TALLAS_SUGERIDAS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Única'];
const METODO_LABELS: Record<string, string> = {
  efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', otro: 'Otro',
};

function varianteLabel(v: MerchVariante) {
  if (!v.modelo && !v.talla) return 'Única';
  if (v.modelo && v.talla) return `${v.modelo} / ${v.talla}`;
  return v.modelo || v.talla || 'Única';
}

export default function MerchManager({ onBack, user, onOpenPOS }: Props) {
  const [tab, setTab] = useState<Tab>('productos');
  const [productos, setProductos] = useState<MerchProducto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProducto, setSelectedProducto] = useState<MerchProducto | null>(null);

  // Product form
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProducto, setEditingProducto] = useState<MerchProducto | null>(null);
  const [pNombre, setPNombre] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [pPrecio, setPPrecio] = useState('');
  const [pCategoria, setPCategoria] = useState('');
  const [pImagenUrl, setPImagenUrl] = useState('');
  const [pSaving, setPSaving] = useState(false);

  // Variant form
  const [showVarianteForm, setShowVarianteForm] = useState(false);
  const [vModelo, setVModelo] = useState('');
  const [vTalla, setVTalla] = useState('');
  const [vSku, setVSku] = useState('');
  const [vCantidad, setVCantidad] = useState('0');
  const [vSaving, setVSaving] = useState(false);

  // Stock editing: variante_id -> edited value
  const [stockEdits, setStockEdits] = useState<Record<string, string>>({});
  const [stockSaving, setStockSaving] = useState<Record<string, boolean>>({});

  // Dashboard
  const [dashboard, setDashboard] = useState<any>(null);
  const [ventas, setVentas] = useState<MerchVenta[]>([]);
  const [dashLoading, setDashLoading] = useState(false);

  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const loadProductos = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/merch/productos');
    const data = await res.json();
    if (Array.isArray(data)) {
      const withStock = data.map((p: MerchProducto) => ({
        ...p,
        variantes: (p.variantes || []).map((v: MerchVariante) => ({
          ...v,
          stock: v.inventario?.[0]?.cantidad ?? 0,
        })),
      }));
      setProductos(withStock);
      if (selectedProducto) {
        const updated = withStock.find((p: MerchProducto) => p.id === selectedProducto.id);
        if (updated) setSelectedProducto(updated);
      }
    }
    setLoading(false);
  }, [selectedProducto]);

  const loadDashboard = useCallback(async () => {
    setDashLoading(true);
    const [dashRes, ventasRes] = await Promise.all([
      fetch('/api/merch/dashboard'),
      fetch('/api/merch/ventas?limit=50'),
    ]);
    const dashData = await dashRes.json();
    const ventasData = await ventasRes.json();
    setDashboard(dashData);
    if (Array.isArray(ventasData)) setVentas(ventasData);
    setDashLoading(false);
  }, []);

  useEffect(() => { loadProductos(); }, []);
  useEffect(() => { if (tab === 'finanzas') loadDashboard(); }, [tab]);

  const openProductForm = (p?: MerchProducto) => {
    if (p) {
      setEditingProducto(p);
      setPNombre(p.nombre);
      setPDesc(p.descripcion || '');
      setPPrecio(String(p.precio));
      setPCategoria(p.categoria || '');
      setPImagenUrl(p.imagen_url || '');
    } else {
      setEditingProducto(null);
      setPNombre(''); setPDesc(''); setPPrecio(''); setPCategoria(''); setPImagenUrl('');
    }
    setShowProductForm(true);
  };

  const handleSaveProducto = async () => {
    if (!pNombre.trim() || !pPrecio) return;
    setPSaving(true);
    const payload = {
      nombre: pNombre.trim(),
      descripcion: pDesc.trim() || null,
      precio: parseFloat(pPrecio),
      imagen_url: pImagenUrl.trim() || null,
      categoria: pCategoria.trim() || null,
    };
    const res = await fetch('/api/merch/productos', {
      method: editingProducto ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingProducto ? { id: editingProducto.id, ...payload } : payload),
    });
    if (res.ok) {
      showToast(editingProducto ? 'Producto actualizado' : 'Producto creado');
      setShowProductForm(false);
      loadProductos();
    }
    setPSaving(false);
  };

  const handleToggleActivo = async (p: MerchProducto) => {
    await fetch('/api/merch/productos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, activo: !p.activo }),
    });
    loadProductos();
  };

  const handleSaveVariante = async () => {
    if (!selectedProducto) return;
    setVSaving(true);
    const res = await fetch('/api/merch/inventario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        producto_id: selectedProducto.id,
        modelo: vModelo.trim() || null,
        talla: vTalla.trim() || null,
        sku: vSku.trim() || null,
        cantidad: parseInt(vCantidad) || 0,
      }),
    });
    if (res.ok) {
      showToast('Variante agregada');
      setShowVarianteForm(false);
      setVModelo(''); setVTalla(''); setVSku(''); setVCantidad('0');
      loadProductos();
    }
    setVSaving(false);
  };

  const handleSaveStock = async (varianteId: string) => {
    const cantidad = parseInt(stockEdits[varianteId]);
    if (isNaN(cantidad) || cantidad < 0) return;
    setStockSaving(prev => ({ ...prev, [varianteId]: true }));
    await fetch('/api/merch/inventario', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variante_id: varianteId, cantidad }),
    });
    setStockEdits(prev => { const n = { ...prev }; delete n[varianteId]; return n; });
    setStockSaving(prev => ({ ...prev, [varianteId]: false }));
    showToast('Stock actualizado');
    loadProductos();
  };

  const handleDeleteVariante = async (varianteId: string) => {
    if (!confirm('¿Eliminar esta variante?')) return;
    await fetch(`/api/merch/inventario?id=${varianteId}`, { method: 'DELETE' });
    loadProductos();
  };

  const categorias = Array.from(new Set(productos.map(p => p.categoria).filter((c): c is string => Boolean(c))));

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* Header */}
      <header className="border-b sticky top-0 z-10" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="text-sm px-3 py-1.5 rounded-lg border transition-all"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
              ← Salir
            </button>
            <div>
              <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>👕 Merch</h1>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{user.nombre}</p>
            </div>
          </div>
          <button onClick={onOpenPOS}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), #0097a7)' }}>
            🛒 Punto de venta
          </button>
        </div>
        {/* Tabs */}
        <div className="max-w-5xl mx-auto px-6 flex gap-1 pb-0">
          {([
            { id: 'productos', label: '📦 Productos' },
            { id: 'inventario', label: '📊 Inventario' },
            { id: 'finanzas', label: '💰 Finanzas' },
          ] as { id: Tab; label: string }[]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="px-4 py-3 text-sm font-medium border-b-2 transition-all"
              style={{
                borderColor: tab === t.id ? 'var(--color-accent)' : 'transparent',
                color: tab === t.id ? 'var(--color-accent)' : 'var(--color-text-muted)',
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-6">

        {/* ===== PRODUCTOS TAB ===== */}
        {tab === 'productos' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Catálogo de productos</h2>
              <button onClick={() => openProductForm()}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: 'var(--color-accent)' }}>
                + Nuevo producto
              </button>
            </div>

            {loading ? (
              <p style={{ color: 'var(--color-text-muted)' }}>Cargando...</p>
            ) : productos.length === 0 ? (
              <div className="text-center py-16 rounded-xl border" style={{ borderColor: 'var(--color-border)' }}>
                <p className="text-4xl mb-3">📦</p>
                <p style={{ color: 'var(--color-text-muted)' }}>Sin productos. Crea el primero.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {productos.map(p => {
                  const totalStock = (p.variantes || []).reduce((s, v) => s + (v.stock ?? 0), 0);
                  return (
                    <div key={p.id} className="rounded-xl border overflow-hidden transition-all hover:shadow-md"
                      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', opacity: p.activo ? 1 : 0.5 }}>
                      {p.imagen_url ? (
                        <img src={p.imagen_url} alt={p.nombre} className="w-full h-40 object-cover" />
                      ) : (
                        <div className="w-full h-40 flex items-center justify-center text-5xl"
                          style={{ background: 'var(--color-bg)' }}>👕</div>
                      )}
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-1">
                          <h3 className="font-semibold text-sm">{p.nombre}</h3>
                          <span className="text-sm font-bold" style={{ color: 'var(--color-accent)' }}>
                            ${Number(p.precio).toLocaleString('es-MX')}
                          </span>
                        </div>
                        {p.categoria && (
                          <span className="text-xs px-2 py-0.5 rounded-full inline-block mb-2"
                            style={{ background: 'rgba(0,188,212,0.1)', color: 'var(--color-accent)' }}>
                            {p.categoria}
                          </span>
                        )}
                        <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
                          {(p.variantes || []).length} variante{(p.variantes || []).length !== 1 ? 's' : ''} · {totalStock} en stock
                        </p>
                        <div className="flex gap-2">
                          <button onClick={() => { setSelectedProducto(p); setTab('inventario'); }}
                            className="flex-1 py-1.5 rounded-lg text-xs border transition-all hover:border-cyan-500"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                            Inventario
                          </button>
                          <button onClick={() => openProductForm(p)}
                            className="flex-1 py-1.5 rounded-lg text-xs border transition-all hover:border-cyan-500"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                            Editar
                          </button>
                          <button onClick={() => handleToggleActivo(p)}
                            className="py-1.5 px-2 rounded-lg text-xs border transition-all"
                            style={{ borderColor: p.activo ? '#ef4444' : '#10b981', color: p.activo ? '#ef4444' : '#10b981' }}>
                            {p.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== INVENTARIO TAB ===== */}
        {tab === 'inventario' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Inventario por producto</h2>
            </div>

            {/* Product selector */}
            <div className="mb-6">
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
                Seleccionar producto
              </label>
              <div className="flex flex-wrap gap-2">
                {productos.filter(p => p.activo).map(p => (
                  <button key={p.id} onClick={() => setSelectedProducto(p)}
                    className="px-3 py-2 rounded-lg text-sm border transition-all"
                    style={{
                      borderColor: selectedProducto?.id === p.id ? 'var(--color-accent)' : 'var(--color-border)',
                      background: selectedProducto?.id === p.id ? 'rgba(0,188,212,0.1)' : 'var(--color-surface)',
                      color: selectedProducto?.id === p.id ? 'var(--color-accent)' : 'var(--color-text)',
                    }}>
                    {p.nombre}
                  </button>
                ))}
              </div>
            </div>

            {selectedProducto && (
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                <div className="px-6 py-4 flex items-center justify-between border-b"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                  <div>
                    <h3 className="font-semibold">{selectedProducto.nombre}</h3>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      Precio: ${Number(selectedProducto.precio).toLocaleString('es-MX')}
                    </p>
                  </div>
                  <button onClick={() => setShowVarianteForm(true)}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                    style={{ background: 'var(--color-accent)' }}>
                    + Agregar variante
                  </button>
                </div>

                {(selectedProducto.variantes || []).length === 0 ? (
                  <div className="py-10 text-center" style={{ background: 'var(--color-bg)' }}>
                    <p style={{ color: 'var(--color-text-muted)' }}>Sin variantes. Agrega tallas o modelos.</p>
                  </div>
                ) : (
                  <table className="w-full" style={{ background: 'var(--color-bg)' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider"
                          style={{ color: 'var(--color-text-muted)' }}>Variante</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider"
                          style={{ color: 'var(--color-text-muted)' }}>SKU</th>
                        <th className="text-center px-6 py-3 text-xs font-semibold uppercase tracking-wider"
                          style={{ color: 'var(--color-text-muted)' }}>Stock</th>
                        <th className="px-6 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedProducto.variantes || []).map(v => {
                        const stock = v.stock ?? 0;
                        const isEditing = v.id in stockEdits;
                        return (
                          <tr key={v.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <td className="px-6 py-4 font-medium text-sm">{varianteLabel(v)}</td>
                            <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                              {v.sku || '—'}
                            </td>
                            <td className="px-6 py-4 text-center">
                              {isEditing ? (
                                <div className="flex items-center justify-center gap-2">
                                  <input type="number" min="0"
                                    value={stockEdits[v.id]}
                                    onChange={e => setStockEdits(prev => ({ ...prev, [v.id]: e.target.value }))}
                                    className="w-20 px-2 py-1 rounded border text-center text-sm"
                                    style={{ borderColor: 'var(--color-accent)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
                                  />
                                  <button onClick={() => handleSaveStock(v.id)}
                                    disabled={stockSaving[v.id]}
                                    className="px-3 py-1 rounded text-xs font-semibold text-white"
                                    style={{ background: 'var(--color-accent)' }}>
                                    {stockSaving[v.id] ? '...' : 'Guardar'}
                                  </button>
                                  <button onClick={() => setStockEdits(prev => { const n = { ...prev }; delete n[v.id]; return n; })}
                                    className="px-2 py-1 rounded text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => setStockEdits(prev => ({ ...prev, [v.id]: String(stock) }))}
                                  className="text-sm font-bold px-3 py-1 rounded-lg border transition-all hover:border-cyan-500"
                                  style={{
                                    borderColor: stock === 0 ? '#ef4444' : stock < 5 ? '#f59e0b' : 'var(--color-border)',
                                    color: stock === 0 ? '#ef4444' : stock < 5 ? '#f59e0b' : 'var(--color-text)',
                                  }}>
                                  {stock}
                                </button>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button onClick={() => handleDeleteVariante(v.id)}
                                className="text-xs px-2 py-1 rounded border transition-all hover:border-red-500 hover:text-red-400"
                                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                                Eliminar
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: '2px solid var(--color-border)' }}>
                        <td colSpan={2} className="px-6 py-3 text-sm font-semibold">Total en stock</td>
                        <td className="px-6 py-3 text-center text-sm font-bold" style={{ color: 'var(--color-accent)' }}>
                          {(selectedProducto.variantes || []).reduce((s, v) => s + (v.stock ?? 0), 0)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            )}

            {!selectedProducto && (
              <div className="text-center py-16 rounded-xl border" style={{ borderColor: 'var(--color-border)' }}>
                <p className="text-4xl mb-3">📊</p>
                <p style={{ color: 'var(--color-text-muted)' }}>Selecciona un producto para ver su inventario.</p>
              </div>
            )}
          </div>
        )}

        {/* ===== FINANZAS TAB ===== */}
        {tab === 'finanzas' && (
          <div>
            <h2 className="text-lg font-semibold mb-6">Resumen financiero</h2>

            {dashLoading ? (
              <p style={{ color: 'var(--color-text-muted)' }}>Cargando...</p>
            ) : dashboard ? (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  {[
                    { label: 'Total ventas', value: dashboard.totalVentas, suffix: '', fmt: (v: number) => v },
                    { label: 'Ingresos totales', value: dashboard.totalIngresos, prefix: '$', fmt: (v: number) => Number(v).toLocaleString('es-MX') },
                    { label: 'Efectivo', value: dashboard.byMethod?.efectivo || 0, prefix: '$', fmt: (v: number) => Number(v).toLocaleString('es-MX') },
                    { label: 'Transferencia', value: dashboard.byMethod?.transferencia || 0, prefix: '$', fmt: (v: number) => Number(v).toLocaleString('es-MX') },
                  ].map(card => (
                    <div key={card.label} className="rounded-xl border p-5"
                      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                      <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{card.label}</p>
                      <p className="text-2xl font-bold" style={{ color: 'var(--color-accent)' }}>
                        {card.prefix}{card.fmt(card.value)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  {/* By method */}
                  <div className="rounded-xl border p-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                    <h3 className="font-semibold mb-4 text-sm">Por método de pago</h3>
                    <div className="space-y-3">
                      {Object.entries(dashboard.byMethod || {}).map(([metodo, monto]) => (
                        <div key={metodo} className="flex items-center justify-between">
                          <span className="text-sm">{METODO_LABELS[metodo] || metodo}</span>
                          <span className="font-semibold text-sm" style={{ color: 'var(--color-accent)' }}>
                            ${Number(monto).toLocaleString('es-MX')}
                          </span>
                        </div>
                      ))}
                      {Object.keys(dashboard.byMethod || {}).length === 0 && (
                        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Sin ventas aún.</p>
                      )}
                    </div>
                  </div>

                  {/* Top products */}
                  <div className="rounded-xl border p-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                    <h3 className="font-semibold mb-4 text-sm">Top productos</h3>
                    <div className="space-y-2">
                      {(dashboard.topProductos || []).map((p: any, i: number) => (
                        <div key={p.nombre} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs w-5 text-center font-bold" style={{ color: 'var(--color-text-muted)' }}>
                              {i + 1}
                            </span>
                            <span className="text-sm">{p.nombre}</span>
                            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>×{p.cantidad}</span>
                          </div>
                          <span className="font-semibold text-sm" style={{ color: 'var(--color-accent)' }}>
                            ${Number(p.total).toLocaleString('es-MX')}
                          </span>
                        </div>
                      ))}
                      {(dashboard.topProductos || []).length === 0 && (
                        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Sin ventas aún.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Recent sales */}
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="px-6 py-4 border-b flex items-center justify-between"
                    style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                    <h3 className="font-semibold text-sm">Ventas recientes</h3>
                    <button onClick={loadDashboard} className="text-xs px-3 py-1 rounded border"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                      Actualizar
                    </button>
                  </div>
                  <div className="overflow-x-auto" style={{ background: 'var(--color-bg)' }}>
                    <table className="w-full">
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                          {['Folio', 'Fecha', 'Cliente', 'Servidor', 'Artículos', 'Total'].map(h => (
                            <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                              style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ventas.length === 0 && (
                          <tr><td colSpan={6} className="px-4 py-8 text-center text-sm"
                            style={{ color: 'var(--color-text-muted)' }}>Sin ventas registradas.</td></tr>
                        )}
                        {ventas.map(v => (
                          <tr key={v.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <td className="px-4 py-3 font-mono font-bold text-sm" style={{ color: 'var(--color-accent)' }}>
                              #{v.folio}
                            </td>
                            <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                              {new Date(v.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-4 py-3 text-sm">{v.cliente_nombre || '—'}</td>
                            <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                              {v.servidor_nombre}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {(v.detalle || []).reduce((s, d) => s + d.cantidad, 0)} pza
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold">
                              ${Number(v.total).toLocaleString('es-MX')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* Product Form Modal */}
      {showProductForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: 'var(--color-surface)' }}>
            <h3 className="text-lg font-bold">{editingProducto ? 'Editar producto' : 'Nuevo producto'}</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  Nombre *
                </label>
                <input value={pNombre} onChange={e => setPNombre(e.target.value)} placeholder="Camiseta, Taza, Llavero..."
                  className="w-full px-3 py-2.5 rounded-lg border text-sm"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                    Precio *
                  </label>
                  <input value={pPrecio} onChange={e => setPPrecio(e.target.value)} type="number" min="0" placeholder="150"
                    className="w-full px-3 py-2.5 rounded-lg border text-sm"
                    style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                    Categoría
                  </label>
                  <input value={pCategoria} onChange={e => setPCategoria(e.target.value)}
                    list="categorias-list" placeholder="Ropa, Accesorios..."
                    className="w-full px-3 py-2.5 rounded-lg border text-sm"
                    style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }} />
                  <datalist id="categorias-list">
                    {categorias.map(c => <option key={c!} value={c!} />)}
                  </datalist>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  Descripción
                </label>
                <textarea value={pDesc} onChange={e => setPDesc(e.target.value)} rows={2}
                  className="w-full px-3 py-2.5 rounded-lg border text-sm resize-none"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  URL de imagen
                </label>
                <input value={pImagenUrl} onChange={e => setPImagenUrl(e.target.value)} placeholder="https://..."
                  className="w-full px-3 py-2.5 rounded-lg border text-sm"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }} />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowProductForm(false)}
                className="flex-1 py-2.5 rounded-lg border text-sm"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                Cancelar
              </button>
              <button onClick={handleSaveProducto} disabled={pSaving || !pNombre.trim() || !pPrecio}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: 'var(--color-accent)' }}>
                {pSaving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Variant Form Modal */}
      {showVarianteForm && selectedProducto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background: 'var(--color-surface)' }}>
            <h3 className="text-lg font-bold">Nueva variante — {selectedProducto.nombre}</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  Modelo / Color
                </label>
                <input value={vModelo} onChange={e => setVModelo(e.target.value)} placeholder="Negro, Blanco, Azul..."
                  className="w-full px-3 py-2.5 rounded-lg border text-sm"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
                  Talla
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {TALLAS_SUGERIDAS.map(t => (
                    <button key={t} onClick={() => setVTalla(t)}
                      className="px-3 py-1 rounded-lg text-xs border transition-all"
                      style={{
                        borderColor: vTalla === t ? 'var(--color-accent)' : 'var(--color-border)',
                        background: vTalla === t ? 'rgba(0,188,212,0.1)' : 'transparent',
                        color: vTalla === t ? 'var(--color-accent)' : 'var(--color-text-muted)',
                      }}>
                      {t}
                    </button>
                  ))}
                </div>
                <input value={vTalla} onChange={e => setVTalla(e.target.value)} placeholder="O escribe una talla..."
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                    SKU
                  </label>
                  <input value={vSku} onChange={e => setVSku(e.target.value)} placeholder="CAM-NEG-M"
                    className="w-full px-3 py-2.5 rounded-lg border text-sm"
                    style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                    Stock inicial
                  </label>
                  <input value={vCantidad} onChange={e => setVCantidad(e.target.value)} type="number" min="0"
                    className="w-full px-3 py-2.5 rounded-lg border text-sm"
                    style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }} />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowVarianteForm(false)}
                className="flex-1 py-2.5 rounded-lg border text-sm"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                Cancelar
              </button>
              <button onClick={handleSaveVariante} disabled={vSaving}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: 'var(--color-accent)' }}>
                {vSaving ? 'Guardando...' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-white text-sm font-semibold shadow-xl"
          style={{ background: 'var(--color-accent)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
