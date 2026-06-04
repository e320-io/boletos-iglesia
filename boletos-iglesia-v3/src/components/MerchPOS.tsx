'use client';

import { useState, useEffect, useCallback } from 'react';
import { User } from '@/lib/auth';
import { MerchProducto, MerchVariante } from '@/types';

interface Props {
  onBack: () => void;
  user: User;
}

interface CartItem {
  variante_id: string;
  producto_id: string;
  producto_nombre: string;
  variante_descripcion: string;
  cantidad: number;
  precio_unitario: number;
}

interface PagoRow {
  metodo_pago: string;
  monto: string;
  referencia: string;
}

type Step = 'browse' | 'checkout' | 'success';

const METODOS = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'otro', label: 'Otro' },
];

function varianteLabel(v: MerchVariante) {
  if (!v.modelo && !v.talla) return 'Única';
  if (v.modelo && v.talla) return `${v.modelo} / ${v.talla}`;
  return v.modelo || v.talla || 'Única';
}

export default function MerchPOS({ onBack, user }: Props) {
  const [step, setStep] = useState<Step>('browse');
  const [productos, setProductos] = useState<MerchProducto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);

  // Variant selector
  const [selectedProduct, setSelectedProduct] = useState<MerchProducto | null>(null);
  const [selectedVariante, setSelectedVariante] = useState<MerchVariante | null>(null);
  const [selectedCantidad, setSelectedCantidad] = useState(1);

  // Checkout fields
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteCorreo, setClienteCorreo] = useState('');
  const [eventos, setEventos] = useState<{ id: string; nombre: string }[]>([]);
  const [eventoId, setEventoId] = useState('');
  const [pagos, setPagos] = useState<PagoRow[]>([{ metodo_pago: 'efectivo', monto: '', referencia: '' }]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [lastFolio, setLastFolio] = useState<number | null>(null);

  const loadProductos = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/merch/productos');
    const data = await res.json();
    if (Array.isArray(data)) {
      const withStock = data
        .filter((p: MerchProducto) => p.activo)
        .map((p: MerchProducto) => ({
          ...p,
          variantes: (p.variantes || []).map((v: MerchVariante) => ({
            ...v,
            stock: v.inventario?.[0]?.cantidad ?? 0,
          })),
        }));
      setProductos(withStock);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProductos();
    fetch('/api/merch/productos').then(() => {});
    // Load events for optional association
    import('@/lib/supabase').then(({ supabase }) => {
      supabase.from('eventos').select('id, nombre').eq('activo', true).order('fecha').then(({ data }) => {
        if (data) setEventos(data);
      });
    });
  }, [loadProductos]);

  const cartTotal = cart.reduce((s, item) => s + item.cantidad * item.precio_unitario, 0);
  const pagosTotal = pagos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0);
  const cartCount = cart.reduce((s, item) => s + item.cantidad, 0);

  const categorias = Array.from(new Set(productos.map(p => p.categoria).filter((c): c is string => Boolean(c))));
  const filteredProductos = productos.filter(p => {
    const matchSearch = !search || p.nombre.toLowerCase().includes(search.toLowerCase());
    const matchCat = !categoriaFilter || p.categoria === categoriaFilter;
    return matchSearch && matchCat;
  });

  const totalStockForProduct = (p: MerchProducto) =>
    (p.variantes || []).reduce((s, v) => s + (v.stock ?? 0), 0);

  const openVariantSelector = (p: MerchProducto) => {
    const availableVariants = (p.variantes || []).filter(v => (v.stock ?? 0) > 0);
    if (availableVariants.length === 0) return;
    setSelectedProduct(p);
    setSelectedVariante(availableVariants.length === 1 ? availableVariants[0] : null);
    setSelectedCantidad(1);
  };

  const addToCart = () => {
    if (!selectedProduct || !selectedVariante) return;
    const label = varianteLabel(selectedVariante);
    setCart(prev => {
      const existing = prev.findIndex(i => i.variante_id === selectedVariante.id);
      if (existing >= 0) {
        const updated = [...prev];
        const newCantidad = updated[existing].cantidad + selectedCantidad;
        const maxStock = selectedVariante.stock ?? 0;
        updated[existing] = { ...updated[existing], cantidad: Math.min(newCantidad, maxStock) };
        return updated;
      }
      return [...prev, {
        variante_id: selectedVariante.id,
        producto_id: selectedProduct.id,
        producto_nombre: selectedProduct.nombre,
        variante_descripcion: label === 'Única' ? '' : label,
        cantidad: selectedCantidad,
        precio_unitario: selectedProduct.precio,
      }];
    });
    setSelectedProduct(null);
    setSelectedVariante(null);
  };

  const updateCartQty = (varianteId: string, delta: number) => {
    setCart(prev => prev
      .map(item => {
        if (item.variante_id !== varianteId) return item;
        // Find stock limit
        const prod = productos.find(p => p.id === item.producto_id);
        const variante = prod?.variantes?.find(v => v.id === varianteId);
        const maxStock = variante?.stock ?? 99;
        return { ...item, cantidad: Math.max(0, Math.min(item.cantidad + delta, maxStock)) };
      })
      .filter(item => item.cantidad > 0)
    );
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setErrorMsg('');

    // Validate payments
    if (pagosTotal < cartTotal) {
      setErrorMsg(`Falta $${(cartTotal - pagosTotal).toLocaleString('es-MX')} por asignar a un método de pago.`);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/merch/ventas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          servidor_id: user.id,
          servidor_nombre: user.nombre,
          cliente_nombre: clienteNombre.trim() || null,
          cliente_correo: clienteCorreo.trim() || null,
          evento_id: eventoId || null,
          items: cart.map(item => ({
            variante_id: item.variante_id,
            producto_nombre: item.producto_nombre,
            variante_descripcion: item.variante_descripcion || null,
            cantidad: item.cantidad,
            precio_unitario: item.precio_unitario,
          })),
          pagos: pagos
            .filter(p => parseFloat(p.monto) > 0)
            .map(p => ({ metodo_pago: p.metodo_pago, monto: parseFloat(p.monto), referencia: p.referencia || null })),
          total: cartTotal,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar venta');

      setLastFolio(data.venta.folio);
      setStep('success');
      loadProductos(); // refresh stock
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const resetSale = () => {
    setCart([]);
    setClienteNombre('');
    setClienteCorreo('');
    setEventoId('');
    setPagos([{ metodo_pago: 'efectivo', monto: '', referencia: '' }]);
    setErrorMsg('');
    setStep('browse');
  };

  // ===== SUCCESS SCREEN =====
  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--color-bg)' }}>
        <div className="text-center max-w-sm w-full">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)' }}>
            ¡Venta registrada!
          </h1>
          <div className="rounded-2xl border p-6 mb-6" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <p className="text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>Folio</p>
            <p className="text-5xl font-bold font-mono" style={{ color: 'var(--color-accent)' }}>#{lastFolio}</p>
            <p className="text-sm mt-3" style={{ color: 'var(--color-text-muted)' }}>
              Total: <strong>${cartTotal.toLocaleString('es-MX')}</strong>
            </p>
            {clienteCorreo && (
              <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                Comprobante enviado a {clienteCorreo}
              </p>
            )}
          </div>
          <button onClick={resetSale}
            className="w-full py-3 rounded-xl text-white font-semibold text-lg mb-3"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), #0097a7)' }}>
            Nueva venta
          </button>
          <button onClick={onBack} className="w-full py-2 rounded-xl text-sm border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
            Salir
          </button>
        </div>
      </div>
    );
  }

  // ===== CHECKOUT SCREEN =====
  if (step === 'checkout') {
    return (
      <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
        <header className="border-b sticky top-0 z-10" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-4">
            <button onClick={() => setStep('browse')}
              className="text-sm px-3 py-1.5 rounded-lg border"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
              ← Volver
            </button>
            <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Checkout</h1>
          </div>
        </header>

        <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
          {/* Cart summary */}
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
            <div className="px-5 py-3 border-b font-semibold text-sm"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
              Resumen de compra
            </div>
            <div style={{ background: 'var(--color-bg)' }}>
              {cart.map(item => (
                <div key={item.variante_id} className="flex items-center justify-between px-5 py-3 border-b"
                  style={{ borderColor: 'var(--color-border)' }}>
                  <div>
                    <p className="text-sm font-medium">{item.producto_nombre}</p>
                    {item.variante_descripcion && (
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{item.variante_descripcion}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      ${(item.cantidad * item.precio_unitario).toLocaleString('es-MX')}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      ×{item.cantidad} · ${item.precio_unitario.toLocaleString('es-MX')} c/u
                    </p>
                  </div>
                </div>
              ))}
              <div className="px-5 py-3 flex justify-between font-bold">
                <span>Total</span>
                <span style={{ color: 'var(--color-accent)' }}>${cartTotal.toLocaleString('es-MX')}</span>
              </div>
            </div>
          </div>

          {/* Customer info */}
          <div className="rounded-xl border p-5 space-y-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <h3 className="font-semibold text-sm">Datos del cliente (opcional)</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Nombre</label>
                <input value={clienteNombre} onChange={e => setClienteNombre(e.target.value)}
                  placeholder="Nombre del cliente"
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  Correo <span style={{ color: 'var(--color-accent)' }}>(envía comprobante)</span>
                </label>
                <input value={clienteCorreo} onChange={e => setClienteCorreo(e.target.value)}
                  type="email" placeholder="correo@ejemplo.com"
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }} />
              </div>
            </div>
            {eventos.length > 0 && (
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  Asociar a evento (opcional)
                </label>
                <select value={eventoId} onChange={e => setEventoId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}>
                  <option value="">Sin evento</option>
                  {eventos.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Payment */}
          <div className="rounded-xl border p-5 space-y-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Pago</h3>
              <button onClick={() => setPagos(prev => [...prev, { metodo_pago: 'efectivo', monto: '', referencia: '' }])}
                className="text-xs px-3 py-1 rounded border"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                + Dividir pago
              </button>
            </div>

            {pagos.map((pago, idx) => (
              <div key={idx} className="flex gap-2 items-start">
                <select value={pago.metodo_pago}
                  onChange={e => setPagos(prev => prev.map((p, i) => i === idx ? { ...p, metodo_pago: e.target.value } : p))}
                  className="px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}>
                  {METODOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <input type="number" min="0" value={pago.monto}
                  onChange={e => setPagos(prev => prev.map((p, i) => i === idx ? { ...p, monto: e.target.value } : p))}
                  placeholder="Monto"
                  className="flex-1 px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }} />
                {(pago.metodo_pago === 'transferencia' || pago.metodo_pago === 'otro') && (
                  <input value={pago.referencia}
                    onChange={e => setPagos(prev => prev.map((p, i) => i === idx ? { ...p, referencia: e.target.value } : p))}
                    placeholder="Referencia"
                    className="flex-1 px-3 py-2 rounded-lg border text-sm"
                    style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }} />
                )}
                {pagos.length > 1 && (
                  <button onClick={() => setPagos(prev => prev.filter((_, i) => i !== idx))}
                    className="py-2 px-2 rounded-lg border text-sm"
                    style={{ borderColor: 'var(--color-border)', color: '#ef4444' }}>✕</button>
                )}
              </div>
            ))}

            {/* Payment status */}
            <div className="flex justify-between text-sm pt-1">
              <span style={{ color: 'var(--color-text-muted)' }}>Total asignado</span>
              <span className="font-semibold"
                style={{ color: pagosTotal >= cartTotal ? '#10b981' : pagosTotal > 0 ? '#f59e0b' : 'var(--color-text)' }}>
                ${pagosTotal.toLocaleString('es-MX')} / ${cartTotal.toLocaleString('es-MX')}
              </span>
            </div>
            {pagosTotal > cartTotal && (
              <p className="text-xs" style={{ color: '#f59e0b' }}>
                Cambio: ${(pagosTotal - cartTotal).toLocaleString('es-MX')}
              </p>
            )}
          </div>

          {errorMsg && (
            <p className="text-sm px-4 py-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
              {errorMsg}
            </p>
          )}

          <button onClick={handleCheckout}
            disabled={saving || cart.length === 0 || pagosTotal < cartTotal}
            className="w-full py-4 rounded-xl text-white font-bold text-lg disabled:opacity-40 transition-all"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), #0097a7)' }}>
            {saving ? 'Procesando...' : `Confirmar venta · $${cartTotal.toLocaleString('es-MX')}`}
          </button>
        </div>
      </div>
    );
  }

  // ===== BROWSE SCREEN =====
  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* Header */}
      <header className="border-b sticky top-0 z-10" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={onBack}
              className="text-sm px-3 py-1.5 rounded-lg border"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
              ← Salir
            </button>
            <div>
              <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>🛒 Punto de Venta</h1>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{user.nombre}</p>
            </div>
          </div>

          {/* Cart button */}
          <button onClick={() => cart.length > 0 && setStep('checkout')}
            disabled={cart.length === 0}
            className="flex items-center gap-3 px-5 py-2.5 rounded-xl border transition-all disabled:opacity-40"
            style={{
              borderColor: cart.length > 0 ? 'var(--color-accent)' : 'var(--color-border)',
              background: cart.length > 0 ? 'rgba(0,188,212,0.1)' : 'transparent',
              color: cart.length > 0 ? 'var(--color-accent)' : 'var(--color-text-muted)',
            }}>
            <span className="text-lg">🛒</span>
            <div className="text-left">
              <div className="text-sm font-semibold">{cartCount} artículo{cartCount !== 1 ? 's' : ''}</div>
              <div className="text-xs">${cartTotal.toLocaleString('es-MX')}</div>
            </div>
            {cart.length > 0 && <span className="text-sm font-bold">→ Cobrar</span>}
          </button>
        </div>

        {/* Search + category filter */}
        <div className="max-w-6xl mx-auto px-6 pb-3 flex gap-3 flex-wrap">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar producto..."
            className="px-4 py-2 rounded-lg border text-sm flex-1 min-w-[200px]"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }} />
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setCategoriaFilter('')}
              className="px-3 py-2 rounded-lg text-xs border transition-all"
              style={{
                borderColor: !categoriaFilter ? 'var(--color-accent)' : 'var(--color-border)',
                background: !categoriaFilter ? 'rgba(0,188,212,0.1)' : 'transparent',
                color: !categoriaFilter ? 'var(--color-accent)' : 'var(--color-text-muted)',
              }}>
              Todos
            </button>
            {categorias.map(c => (
              <button key={c!} onClick={() => setCategoriaFilter(c === categoriaFilter ? '' : c!)}
                className="px-3 py-2 rounded-lg text-xs border transition-all"
                style={{
                  borderColor: categoriaFilter === c ? 'var(--color-accent)' : 'var(--color-border)',
                  background: categoriaFilter === c ? 'rgba(0,188,212,0.1)' : 'transparent',
                  color: categoriaFilter === c ? 'var(--color-accent)' : 'var(--color-text-muted)',
                }}>
                {c}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {loading ? (
          <p style={{ color: 'var(--color-text-muted)' }}>Cargando productos...</p>
        ) : filteredProductos.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-3">📦</p>
            <p style={{ color: 'var(--color-text-muted)' }}>No hay productos disponibles.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredProductos.map(p => {
              const stock = totalStockForProduct(p);
              const inCart = cart.filter(i => i.producto_id === p.id).reduce((s, i) => s + i.cantidad, 0);
              const agotado = stock === 0;

              return (
                <button key={p.id} onClick={() => !agotado && openVariantSelector(p)}
                  disabled={agotado}
                  className="rounded-xl border overflow-hidden text-left transition-all hover:shadow-md hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed relative"
                  style={{ borderColor: inCart > 0 ? 'var(--color-accent)' : 'var(--color-border)', background: 'var(--color-surface)' }}>
                  {inCart > 0 && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white z-10"
                      style={{ background: 'var(--color-accent)' }}>
                      {inCart}
                    </div>
                  )}
                  {p.imagen_url ? (
                    <img src={p.imagen_url} alt={p.nombre} className="w-full h-32 object-cover" />
                  ) : (
                    <div className="w-full h-32 flex items-center justify-center text-4xl"
                      style={{ background: 'var(--color-bg)' }}>👕</div>
                  )}
                  <div className="p-3">
                    <p className="text-sm font-semibold leading-tight mb-1">{p.nombre}</p>
                    <p className="text-base font-bold" style={{ color: 'var(--color-accent)' }}>
                      ${Number(p.precio).toLocaleString('es-MX')}
                    </p>
                    <p className="text-xs mt-1" style={{ color: agotado ? '#ef4444' : stock < 5 ? '#f59e0b' : 'var(--color-text-muted)' }}>
                      {agotado ? 'Agotado' : `${stock} disponibles`}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Cart preview at bottom */}
        {cart.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 border-t px-6 py-4 z-20"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
              <div className="flex gap-3 flex-wrap flex-1">
                {cart.map(item => (
                  <div key={item.variante_id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border"
                    style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
                    <span>{item.producto_nombre}{item.variante_descripcion ? ` — ${item.variante_descripcion}` : ''}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateCartQty(item.variante_id, -1)}
                        className="w-5 h-5 rounded flex items-center justify-center font-bold text-xs"
                        style={{ background: 'var(--color-border)' }}>−</button>
                      <span className="font-bold text-xs w-4 text-center">{item.cantidad}</span>
                      <button onClick={() => updateCartQty(item.variante_id, 1)}
                        className="w-5 h-5 rounded flex items-center justify-center font-bold text-xs"
                        style={{ background: 'var(--color-border)' }}>+</button>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setStep('checkout')}
                className="px-6 py-3 rounded-xl text-white font-bold whitespace-nowrap"
                style={{ background: 'linear-gradient(135deg, var(--color-accent), #0097a7)' }}>
                Cobrar ${cartTotal.toLocaleString('es-MX')} →
              </button>
            </div>
          </div>
        )}
        {cart.length > 0 && <div className="h-20" />}
      </div>

      {/* Variant selector modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={e => { if (e.target === e.currentTarget) setSelectedProduct(null); }}>
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 space-y-5"
            style={{ background: 'var(--color-surface)' }}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold">{selectedProduct.nombre}</h3>
                <p className="text-xl font-bold" style={{ color: 'var(--color-accent)' }}>
                  ${Number(selectedProduct.precio).toLocaleString('es-MX')}
                </p>
              </div>
              <button onClick={() => setSelectedProduct(null)}
                className="text-xl px-2" style={{ color: 'var(--color-text-muted)' }}>✕</button>
            </div>

            {/* Variant buttons */}
            {(selectedProduct.variantes || []).filter(v => (v.stock ?? 0) > 0).length > 1 && (
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
                  Selecciona variante
                </p>
                <div className="flex flex-wrap gap-2">
                  {(selectedProduct.variantes || []).map(v => {
                    const stock = v.stock ?? 0;
                    const isSelected = selectedVariante?.id === v.id;
                    return (
                      <button key={v.id} onClick={() => stock > 0 && setSelectedVariante(v)}
                        disabled={stock === 0}
                        className="px-3 py-2 rounded-lg text-sm border transition-all disabled:opacity-30"
                        style={{
                          borderColor: isSelected ? 'var(--color-accent)' : stock < 3 ? '#f59e0b' : 'var(--color-border)',
                          background: isSelected ? 'rgba(0,188,212,0.15)' : 'transparent',
                          color: isSelected ? 'var(--color-accent)' : 'var(--color-text)',
                        }}>
                        {varianteLabel(v)}
                        <span className="ml-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>({stock})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedVariante && (
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>Cantidad</p>
                <div className="flex items-center gap-4">
                  <button onClick={() => setSelectedCantidad(c => Math.max(1, c - 1))}
                    className="w-10 h-10 rounded-full text-xl font-bold flex items-center justify-center border"
                    style={{ borderColor: 'var(--color-border)' }}>−</button>
                  <span className="text-2xl font-bold w-10 text-center">{selectedCantidad}</span>
                  <button onClick={() => setSelectedCantidad(c => Math.min(c + 1, selectedVariante.stock ?? 99))}
                    className="w-10 h-10 rounded-full text-xl font-bold flex items-center justify-center border"
                    style={{ borderColor: 'var(--color-border)' }}>+</button>
                  <span className="text-sm ml-2" style={{ color: 'var(--color-text-muted)' }}>
                    max {selectedVariante.stock}
                  </span>
                </div>
              </div>
            )}

            <button onClick={addToCart} disabled={!selectedVariante}
              className="w-full py-3 rounded-xl text-white font-bold text-base disabled:opacity-40 transition-all"
              style={{ background: 'linear-gradient(135deg, var(--color-accent), #0097a7)' }}>
              {selectedVariante
                ? `Agregar al carrito · $${(selectedCantidad * selectedProduct.precio).toLocaleString('es-MX')}`
                : 'Selecciona una variante'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
