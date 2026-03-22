'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function ResultContent() {
  const params = useSearchParams();
  const status = params.get('status');
  const registros = params.get('registros');

  const isSuccess = status === 'success';
  const isPending = status === 'pending';
  const isFailure = status === 'failure';

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--color-bg)' }}>
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center text-4xl"
          style={{
            background: isSuccess ? 'rgba(16,185,129,0.1)' : isPending ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
          }}>
          {isSuccess ? '✓' : isPending ? '⏳' : '✕'}
        </div>

        <h1 className="text-2xl font-bold mb-3" style={{ fontFamily: 'var(--font-display)' }}>
          {isSuccess ? '¡Compra exitosa!' : isPending ? 'Pago pendiente' : 'Pago no procesado'}
        </h1>

        <p className="text-sm mb-8" style={{ color: 'var(--color-text-muted)' }}>
          {isSuccess
            ? 'Tu boleto ha sido confirmado. Recibirás un comprobante en tu correo electrónico en los próximos minutos.'
            : isPending
              ? 'Tu pago está en proceso. Recibirás una confirmación por correo cuando se complete. Si pagaste en OXXO o tienda, puede tomar hasta 2 horas.'
              : 'Hubo un problema con tu pago. No se realizó ningún cargo. Puedes intentar de nuevo.'}
        </p>

        <div className="flex gap-3 justify-center">
          <a href="/comprar"
            className="px-6 py-3 rounded-lg font-bold text-white"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), #0097a7)', fontFamily: 'var(--font-display)' }}>
            {isFailure ? 'Intentar de nuevo' : 'Volver al inicio'}
          </a>
        </div>
      </div>
    </div>
  );
}

export default function ResultadoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>Cargando...</p>
      </div>
    }>
      <ResultContent />
    </Suspense>
  );
}
