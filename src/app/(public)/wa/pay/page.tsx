'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback, useRef, Suspense } from 'react';

interface BookingInfo {
  booking_id: string;
  status: string;
  payment_status: string;
  patient_name: string;
  doctor_name: string;
  specialty: string;
  appointment_date: string;
  appointment_time: string;
  op_pass_id: string | null;
  payment_link: string | null;
  consultation_fee: number | null;
}

/* ── Inline styles (no tailwind in public pages) ── */
const colors = {
  bg: '#f8fafc',
  card: '#ffffff',
  primary: '#0f172a',
  accent: '#2563eb',
  accentLight: '#eff6ff',
  success: '#059669',
  successBg: '#ecfdf5',
  successLight: '#d1fae5',
  muted: '#64748b',
  mutedLight: '#94a3b8',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
};

const font = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';

function PayPageContent() {
  const params = useSearchParams();
  const bookingId = params.get('id') || '';
  const rzpStatus = params.get('razorpay_payment_link_status');

  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState('');
  const [verifyingTimeout, setVerifyingTimeout] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCount = useRef(0);

  const returnedFromPayment = rzpStatus === 'paid' || (() => {
    try { return localStorage.getItem('pay_active') === bookingId; } catch { return false; }
  })();

  const checkStatus = useCallback(async () => {
    if (!bookingId) return;
    try {
      const res = await fetch('/api/payment/status?booking_id=' + encodeURIComponent(bookingId));
      if (!res.ok) {
        if (res.status === 404) setError('Booking not found');
        return;
      }
      const data: BookingInfo = await res.json();
      setBooking(data);
      setLoading(false);
      if (data.payment_status === 'paid' || data.status === 'confirmed') {
        setPaid(true);
      }
      pollCount.current++;
      // After 20 polls (~60s) show timeout message
      if (pollCount.current > 20 && returnedFromPayment && !paid) {
        setVerifyingTimeout(true);
      }
    } catch { /* retry */ }
  }, [bookingId, returnedFromPayment, paid]);

  useEffect(() => {
    if (!bookingId) { setError('No booking ID'); setLoading(false); return; }
    checkStatus();
    intervalRef.current = setInterval(checkStatus, 3000);
    const onVisible = () => { if (document.visibilityState === 'visible') checkStatus(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [bookingId, checkStatus]);

  useEffect(() => {
    if (paid) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      try { localStorage.removeItem('pay_active'); } catch {}
    }
  }, [paid]);

  const [payLoading, setPayLoading] = useState(false);

  const handlePay = async () => {
    if (!booking) return;

    // If payment link exists, redirect to it
    if (booking.payment_link) {
      try { localStorage.setItem('pay_active', bookingId); } catch {}
      window.location.href = booking.payment_link;
      return;
    }

    // Otherwise use Razorpay Checkout
    setPayLoading(true);
    try {
      const res = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed' }));
        setError(err.error || 'Failed to create payment');
        setPayLoading(false);
        return;
      }
      const order = await res.json();

      // Load Razorpay script
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => {
        const options = {
          key: order.key_id,
          amount: order.amount,
          currency: order.currency,
          name: booking.doctor_name || 'Consultation',
          description: `Appointment: ${booking.appointment_date} ${booking.appointment_time}`,
          order_id: order.order_id,
          prefill: {
            name: order.patient_name || '',
            contact: order.patient_phone || '',
          },
          handler: function () {
            try { localStorage.setItem('pay_active', bookingId); } catch {}
            setPaid(false); // trigger polling
            checkStatus();
          },
          theme: { color: '#2563eb' },
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rzp = new (window as unknown as Record<string, any>).Razorpay(options);
        rzp.on('payment.failed', function () {
          setError('Payment failed. Please try again.');
        });
        rzp.open();
        setPayLoading(false);
      };
      document.body.appendChild(script);
    } catch {
      setError('Something went wrong. Please try again.');
      setPayLoading(false);
    }
  };

  const handleBackToWhatsApp = () => {
    try { window.close(); } catch {}
    setTimeout(() => { window.location.href = 'https://wa.me/'; }, 500);
  };

  const fee = booking?.consultation_fee;
  const displayFee = fee ? `₹${fee}` : null;

  // ── Loading ──
  if (loading) {
    return (
      <PageShell>
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <Spinner size={44} />
          <p style={{ color: colors.muted, fontSize: 15, marginTop: 20, fontWeight: 500 }}>
            {returnedFromPayment ? 'Verifying your payment...' : 'Loading appointment...'}
          </p>
        </div>
      </PageShell>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <PageShell>
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <h1 style={{ fontSize: 20, color: colors.primary, fontWeight: 700, margin: '0 0 8px' }}>Something went wrong</h1>
          <p style={{ color: colors.muted, fontSize: 14 }}>{error}</p>
          <button onClick={handleBackToWhatsApp} style={{ ...btnStyle, background: colors.accent, marginTop: 24, padding: '12px 32px' }}>
            Back to WhatsApp
          </button>
        </div>
      </PageShell>
    );
  }

  // ── PAID / Success ──
  if (paid && booking) {
    return (
      <PageShell>
        {/* Success header */}
        <div style={{ textAlign: 'center', padding: '32px 24px 24px' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: colors.successBg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', border: `3px solid ${colors.successLight}` }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={colors.success} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: colors.primary, margin: '0 0 4px' }}>Appointment Confirmed</h1>
          <p style={{ fontSize: 14, color: colors.success, fontWeight: 600, margin: 0 }}>Payment successful</p>
        </div>

        {/* Appointment card */}
        <div style={{ margin: '0 16px 16px', background: colors.bg, borderRadius: 16, padding: 20, border: `1px solid ${colors.border}` }}>
          {/* Doctor info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: colors.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: colors.primary, margin: 0 }}>{booking.doctor_name}</p>
              <p style={{ fontSize: 13, color: colors.muted, margin: '2px 0 0', fontWeight: 500 }}>{booking.specialty}</p>
            </div>
          </div>

          <div style={{ height: 1, background: colors.border, margin: '0 0 14px' }} />

          {/* Date & Time chips */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <Chip icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>} text={booking.appointment_date} />
            <Chip icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>} text={booking.appointment_time} />
          </div>

          {/* Patient & details */}
          <DetailRow label="Patient" value={booking.patient_name} />
          <DetailRow label="Booking ID" value={booking.booking_id} mono />
          {booking.op_pass_id && <DetailRow label="OP Pass" value={booking.op_pass_id} mono highlight />}
          {displayFee && <DetailRow label="Amount Paid" value={displayFee} highlight />}
        </div>

        {/* OP Pass notice */}
        <div style={{ margin: '0 16px 20px', background: colors.successBg, borderRadius: 12, padding: '14px 16px', border: `1px solid ${colors.successLight}`, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.success} strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <div>
            <p style={{ fontSize: 13, color: '#065f46', fontWeight: 600, margin: '0 0 2px' }}>Digital OP Pass sent on WhatsApp</p>
            <p style={{ fontSize: 12, color: '#047857', margin: 0 }}>Present the pass at reception on arrival</p>
          </div>
        </div>

        {/* CTA */}
        <div style={{ padding: '0 16px 32px', display: 'flex', gap: 10 }}>
          <button onClick={handleBackToWhatsApp} style={{ ...btnStyle, flex: 1, background: '#25D366', fontSize: 15, padding: '14px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.556 4.122 1.528 5.853L0 24l6.335-1.652A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-1.875 0-3.625-.513-5.13-1.396l-.368-.217-3.81.994.996-3.727-.24-.38A9.72 9.72 0 0 1 2.25 12c0-5.385 4.365-9.75 9.75-9.75S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/></svg>
            Back to WhatsApp
          </button>
        </div>
      </PageShell>
    );
  }

  // ── Verifying payment (returned from Razorpay) ──
  if (returnedFromPayment && !paid) {
    return (
      <PageShell>
        <div style={{ textAlign: 'center', padding: '80px 24px' }}>
          <Spinner size={48} />
          <h1 style={{ fontSize: 20, color: colors.primary, fontWeight: 700, marginTop: 24, marginBottom: 8 }}>Verifying Payment</h1>
          <p style={{ color: colors.muted, fontSize: 14, lineHeight: 1.5 }}>
            {verifyingTimeout
              ? 'Taking longer than usual. Your payment is safe — you\'ll receive confirmation on WhatsApp shortly.'
              : 'Please wait while we confirm your payment. This usually takes a few seconds.'}
          </p>
          {verifyingTimeout && (
            <button onClick={handleBackToWhatsApp} style={{ ...btnStyle, background: '#25D366', marginTop: 24, padding: '12px 32px' }}>
              Back to WhatsApp
            </button>
          )}
        </div>
      </PageShell>
    );
  }

  // ── Payment page (NOT PAID) ──
  return (
    <PageShell>
      {/* Header */}
      <div style={{ padding: '28px 20px 20px', textAlign: 'center' }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: colors.accent, textTransform: 'uppercase', letterSpacing: 1.5, margin: '0 0 6px' }}>Appointment Booking</p>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: colors.primary, margin: 0 }}>Complete Payment</h1>
      </div>

      {/* Doctor card */}
      <div style={{ margin: '0 16px 16px', background: colors.bg, borderRadius: 16, padding: 20, border: `1px solid ${colors.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div>
            <p style={{ fontSize: 17, fontWeight: 700, color: colors.primary, margin: 0 }}>{booking?.doctor_name || ''}</p>
            <p style={{ fontSize: 13, color: colors.accent, margin: '2px 0 0', fontWeight: 600 }}>{booking?.specialty || ''}</p>
          </div>
        </div>

        <div style={{ height: 1, background: colors.border, margin: '0 0 14px' }} />

        {/* Date & Time chips */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <Chip icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>} text={booking?.appointment_date || ''} />
          <Chip icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>} text={booking?.appointment_time || ''} />
        </div>

        <DetailRow label="Patient" value={booking?.patient_name || ''} />
        <DetailRow label="Booking ID" value={booking?.booking_id || ''} mono />
      </div>

      {/* Amount & Pay */}
      <div style={{ margin: '0 16px 16px', background: colors.card, borderRadius: 16, padding: 20, border: `1px solid ${colors.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        {displayFee && (
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <p style={{ fontSize: 12, color: colors.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px' }}>Consultation Fee</p>
            <p style={{ fontSize: 36, fontWeight: 800, color: colors.primary, margin: 0 }}>{displayFee}</p>
          </div>
        )}

        <button
          onClick={handlePay}
          disabled={payLoading}
          style={{
            ...btnStyle,
            width: '100%', padding: '16px 0', fontSize: 16,
            background: payLoading ? '#cbd5e1' : '#059669',
            cursor: payLoading ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          {payLoading ? 'Loading...' : displayFee ? `Pay ${displayFee}` : 'Pay Now'}
        </button>
      </div>

      {/* Trust badges */}
      <div style={{ margin: '0 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <TrustBadge icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>} text="Secure Payment" />
        <TrustBadge icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>} text="Razorpay Protected" />
      </div>

      {/* UPI hint */}
      <div style={{ margin: '12px 16px 24px', padding: '12px 16px', background: colors.accentLight, borderRadius: 10, border: '1px solid #bfdbfe' }}>
        <p style={{ fontSize: 12, color: '#1e40af', margin: 0, textAlign: 'center', lineHeight: 1.5 }}>
          After completing UPI payment, press the <strong>back button</strong> to see your confirmation.
        </p>
      </div>

      <p style={{ textAlign: 'center', fontSize: 11, color: colors.mutedLight, padding: '0 16px 24px', margin: 0 }}>
        Payments secured by Razorpay. Your data is encrypted end-to-end.
      </p>
    </PageShell>
  );
}

/* ── Shared components ── */

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: colors.bg, fontFamily: font }}>
      <div style={{ maxWidth: 440, margin: '0 auto' }}>
        <div style={{ background: colors.card, minHeight: '100vh', boxShadow: '0 0 40px rgba(0,0,0,0.04)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function Spinner({ size = 40 }: { size?: number }) {
  return (
    <>
      <div style={{
        width: size, height: size,
        border: `3px solid ${colors.border}`, borderTopColor: colors.accent,
        borderRadius: '50%', animation: 'spin 0.8s linear infinite',
        margin: '0 auto',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>
  );
}

function Chip({ icon, text }: { icon: React.ReactNode; text: string }) {
  if (!text) return null;
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: colors.card, borderRadius: 10, padding: '10px 12px', border: `1px solid ${colors.border}` }}>
      <span style={{ color: colors.accent, display: 'flex' }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: colors.primary }}>{text}</span>
    </div>
  );
}

function DetailRow({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${colors.borderLight}` }}>
      <span style={{ fontSize: 13, color: colors.muted, fontWeight: 500 }}>{label}</span>
      <span style={{
        fontSize: 14, fontWeight: 700, color: highlight ? colors.success : colors.primary,
        fontFamily: mono ? '"SF Mono",Monaco,Consolas,monospace' : 'inherit',
        background: highlight ? colors.successBg : 'transparent',
        padding: highlight ? '2px 8px' : 0,
        borderRadius: 6,
      }}>{value}</span>
    </div>
  );
}

function TrustBadge({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ color: colors.mutedLight, display: 'flex' }}>{icon}</span>
      <span style={{ fontSize: 11, color: colors.mutedLight, fontWeight: 500 }}>{text}</span>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  border: 'none', borderRadius: 12, fontWeight: 700, color: '#fff',
  cursor: 'pointer', fontFamily: font, fontSize: 15, gap: 8,
  transition: 'opacity 0.15s',
};

export default function PayPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: colors.bg, fontFamily: font }}>
        <Spinner />
      </div>
    }>
      <PayPageContent />
    </Suspense>
  );
}
