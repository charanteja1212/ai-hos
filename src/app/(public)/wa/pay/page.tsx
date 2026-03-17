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
}

function PayPageContent() {
  const params = useSearchParams();
  const bookingId = params.get('id') || '';
  // Detect return from Razorpay via callback_url
  const rzpStatus = params.get('razorpay_payment_link_status');

  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Detect if returning from payment
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
    } catch { /* retry */ }
  }, [bookingId]);

  // Initial check + polling
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

  // Stop polling once paid
  useEffect(() => {
    if (paid) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      try { localStorage.removeItem('pay_active'); } catch {}
    }
  }, [paid]);

  const handlePay = () => {
    if (booking?.payment_link) {
      try { localStorage.setItem('pay_active', bookingId); } catch {}
      window.location.href = booking.payment_link;
    }
  };

  const handleBackToWhatsApp = () => {
    try { window.close(); } catch {}
    setTimeout(() => { window.location.href = 'https://wa.me/'; }, 500);
  };

  // Loading state
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f4f8', fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#64748b', fontSize: 14 }}>
            {returnedFromPayment ? 'Verifying payment...' : 'Loading booking details...'}
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f4f8', fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif', padding: 20 }}>
        <div style={{ background: '#fff', padding: '40px 24px', borderRadius: 16, textAlign: 'center', maxWidth: 400, width: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>&#10060;</div>
          <h1 style={{ fontSize: 20, color: '#dc2626', marginBottom: 8 }}>Error</h1>
          <p style={{ color: '#64748b', fontSize: 14 }}>{error}</p>
        </div>
      </div>
    );
  }

  // PAID — success
  if (paid && booking) {
    return (
      <div style={{ minHeight: '100vh', background: '#f0fdf4', fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif', padding: 16 }}>
        <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', maxWidth: 440, margin: '20px auto', boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}>
          <div style={{ background: '#059669', padding: '28px 20px', textAlign: 'center', color: '#fff' }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>&#9989;</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Payment Successful!</h1>
            <p style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>Your appointment is confirmed</p>
          </div>
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Row label="Patient" value={booking.patient_name} />
              <Row label="Doctor" value={booking.doctor_name} />
              <Row label="Department" value={booking.specialty} />
              <Row label="Date" value={booking.appointment_date} />
              <Row label="Time" value={booking.appointment_time} />
              {booking.op_pass_id && <Row label="OP Pass" value={booking.op_pass_id} />}
              <Row label="Booking ID" value={booking.booking_id} />
            </div>
          </div>
          <div style={{ padding: '16px 20px', background: '#f0fdf4', borderTop: '1px solid #dcfce7', textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: '#059669', fontWeight: 600, margin: '0 0 4px' }}>OP Pass sent on WhatsApp</p>
            <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Present the digital pass at reception</p>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button onClick={handleBackToWhatsApp} style={{ display: 'inline-block', background: '#25D366', color: '#fff', padding: '14px 36px', borderRadius: 12, border: 'none', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
            Back to WhatsApp
          </button>
        </div>
      </div>
    );
  }

  // Returned from payment but not yet confirmed — verifying
  if (returnedFromPayment && !paid) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f4f8', fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif', padding: 20 }}>
        <div style={{ background: '#fff', padding: '40px 24px', borderRadius: 16, textAlign: 'center', maxWidth: 400, width: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <h1 style={{ fontSize: 18, color: '#1e293b', marginBottom: 8 }}>Verifying Payment...</h1>
          <p style={{ color: '#64748b', fontSize: 14 }}>Please wait while we confirm your payment.</p>
          <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 16 }}>This usually takes a few seconds.</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    );
  }

  // NOT PAID — show pay button
  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f8', fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', maxWidth: 440, margin: '20px auto', boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}>
        <div style={{ background: '#0284c7', padding: '24px 20px', textAlign: 'center', color: '#fff' }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px' }}>Complete Payment</h1>
          <p style={{ fontSize: 13, opacity: 0.9, margin: 0 }}>Appointment Booking</p>
        </div>
        <div style={{ padding: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Row label="Patient" value={booking?.patient_name || ''} />
            <Row label="Doctor" value={booking?.doctor_name || ''} />
            <Row label="Department" value={booking?.specialty || ''} />
            <Row label="Date" value={booking?.appointment_date || ''} />
            <Row label="Time" value={booking?.appointment_time || ''} />
          </div>
        </div>
        <div style={{ padding: '0 20px 24px', textAlign: 'center' }}>
          <button
            onClick={handlePay}
            disabled={!booking?.payment_link}
            style={{
              width: '100%', padding: '16px', background: '#059669',
              color: '#fff', border: 'none', borderRadius: 12, fontSize: 18, fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Pay Now
          </button>
          <div style={{ marginTop: 16, padding: '12px 16px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10 }}>
            <p style={{ fontSize: 13, color: '#0369a1', margin: 0 }}>
              After completing UPI payment, press the <strong>&larr; back button</strong> to see your confirmation here.
            </p>
          </div>
        </div>
      </div>
      <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 16 }}>
        Payment is secured by Razorpay
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 14, color: '#1e293b', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

export default function PayPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f4f8' }}>
        <p style={{ color: '#64748b' }}>Loading...</p>
      </div>
    }>
      <PayPageContent />
    </Suspense>
  );
}
