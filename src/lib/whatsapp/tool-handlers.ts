/**
 * WhatsApp Bot Tool Handlers — Direct Supabase Implementation
 * Replaces all n8n webhook tool calls with direct database operations.
 * Each handler mirrors the exact logic of the corresponding n8n workflow.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const SB_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1';
const SB_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY!;

const sbHeaders = () => ({
  'apikey': SB_KEY(),
  'Authorization': 'Bearer ' + SB_KEY(),
  'Content-Type': 'application/json',
});

const sbHeadersRepr = () => ({
  ...sbHeaders(),
  'Prefer': 'return=representation',
});

async function sbGet(path: string): Promise<any> {
  const res = await fetch(SB_URL() + path, {
    headers: { 'apikey': SB_KEY(), 'Authorization': 'Bearer ' + SB_KEY() },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Supabase GET ${path}: ${res.status}`);
  return res.json();
}

async function sbPost(path: string, body: any): Promise<any> {
  const res = await fetch(SB_URL() + path, {
    method: 'POST',
    headers: sbHeadersRepr(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Supabase POST ${path}: ${res.status} ${txt.substring(0, 200)}`);
  }
  return res.json();
}

async function sbPatch(path: string, body: any): Promise<void> {
  const res = await fetch(SB_URL() + path, {
    method: 'PATCH',
    headers: sbHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Supabase PATCH ${path}: ${res.status} ${txt.substring(0, 200)}`);
  }
}

async function sbDelete(path: string): Promise<void> {
  await fetch(SB_URL() + path, {
    method: 'DELETE',
    headers: sbHeaders(),
    signal: AbortSignal.timeout(10000),
  });
}

function normalizePhone(raw: string): string {
  return String(raw || '').replace(/[^\d]/g, '');
}

function nowIST(): { date: Date; dateStr: string; ms: number } {
  const now = new Date();
  const istMs = now.getTime() + 5.5 * 3600000;
  const istDate = new Date(istMs);
  return { date: istDate, dateStr: istDate.toISOString().split('T')[0], ms: istMs };
}

// ==================== 1. LOOKUP PATIENT ====================

export async function lookupPatient(args: any): Promise<any> {
  const tenantId = args.tenant_id || 'T001';
  const phone = normalizePhone(args.phone);
  if (!phone) return { found: false, message: 'No phone number provided' };

  try {
    const patients = await sbGet(
      '/patients?or=(phone.eq.' + phone + ',phone.eq.%2B' + phone +
      ')&tenant_id=eq.' + encodeURIComponent(tenantId)
    );
    if (!Array.isArray(patients) || patients.length === 0) {
      return { found: false, message: 'No patient found with this phone number' };
    }
    const p = patients[0];
    return {
      found: true, phone: String(p.phone || ''), name: p.name || '',
      dob: p.dob || '', gender: p.gender || '',
      medical_conditions: p.medical_conditions || '', allergies: p.allergies || '',
      emergency_contact: p.emergency_contact || '', email: p.email || '',
      created_at: p.created_at || '', updated_at: p.updated_at || '',
    };
  } catch (e: any) {
    return { found: false, message: 'Lookup error: ' + (e.message || 'Unknown') };
  }
}

// ==================== 2. SAVE PATIENT ====================

export async function savePatient(args: any): Promise<any> {
  const tenantId = args.tenant_id || 'T001';
  const phone = normalizePhone(args.phone);
  if (!phone || phone.length < 10) return { success: false, message: 'Valid phone number (10+ digits) is required' };

  const now = new Date().toISOString();
  const data: any = { phone, tenant_id: tenantId, updated_at: now };
  if (args.name) data.name = args.name;
  if (args.email) data.email = args.email;
  if (args.age !== undefined && args.age !== null) data.age = parseInt(args.age, 10);
  if (args.address) data.address = args.address;
  if (args.dob) data.dob = args.dob;
  if (args.gender) data.gender = args.gender;
  if (args.medical_conditions) data.medical_conditions = args.medical_conditions;
  if (args.allergies) data.allergies = args.allergies;
  if (args.emergency_contact) data.emergency_contact = args.emergency_contact;

  try {
    const existing = await sbGet(
      '/patients?or=(phone.eq.' + phone + ',phone.eq.%2B' + phone +
      ')&tenant_id=eq.' + encodeURIComponent(tenantId) + '&select=phone,created_at'
    );

    if (Array.isArray(existing) && existing.length > 0) {
      data.created_at = existing[0].created_at || now;
      await sbPatch(
        '/patients?phone=eq.' + encodeURIComponent(existing[0].phone) +
        '&tenant_id=eq.' + encodeURIComponent(tenantId), data
      );
      return { success: true, message: 'Patient data updated successfully', phone };
    } else {
      data.name = data.name || 'Patient';
      data.created_at = now;
      await sbPost('/patients', data);
      return { success: true, message: 'Patient registered successfully', phone };
    }
  } catch (e: any) {
    return { success: false, message: 'Failed to save patient: ' + (e.message || 'Unknown') };
  }
}

// ==================== 3. LIST SPECIALTIES ====================

export async function listSpecialties(args: any): Promise<any> {
  const tenantId = args.tenant_id || 'T001';
  try {
    const doctors = await sbGet(
      '/doctors?status=eq.active&tenant_id=eq.' + encodeURIComponent(tenantId) +
      '&select=doctor_id,name,specialty'
    );
    if (!Array.isArray(doctors)) return { specialties: [], total_specialties: 0, total_doctors: 0 };

    const map: Record<string, any[]> = {};
    for (const d of doctors) {
      const s = d.specialty || 'Uncategorized';
      if (!map[s]) map[s] = [];
      map[s].push({ doctor_id: d.doctor_id, name: d.name });
    }
    const specialties = Object.keys(map).map(s => ({
      specialty: s, doctors: map[s], doctor_count: map[s].length,
    }));
    return { specialties, total_specialties: specialties.length, total_doctors: doctors.length };
  } catch (e: any) {
    return { specialties: [], total_specialties: 0, total_doctors: 0, error: e.message };
  }
}

// ==================== 4. CHECK AVAILABILITY 7 DAYS ====================

export async function checkAvailability7Days(args: any): Promise<any> {
  const tenantId = args.tenant_id || 'T001';
  const doctorId = args.doctor_id;
  const patientPhone = normalizePhone(args.patient_phone || '');
  const excludeApptId = args.exclude_appointment_id || '';

  if (!doctorId) return { success: false, error: 'doctor_id is required' };

  const ist = nowIST();
  const todayDate = new Date(ist.dateStr + 'T00:00:00+05:30');

  // Generate 7 dates starting from today IST
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    // Build date string directly from IST date to avoid UTC date-shift bug
    const dayMs = todayDate.getTime() + i * 86400000 + 5.5 * 3600000;
    const dayD = new Date(dayMs);
    const yyyy = dayD.getUTCFullYear();
    const mm = String(dayD.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dayD.getUTCDate()).padStart(2, '0');
    dates.push(yyyy + '-' + mm + '-' + dd);
  }

  try {
    // Fetch all required data in parallel
    const [schedules, overrides, leaves, bookedSlots, patientSlots, locks] = await Promise.all([
      sbGet('/doctor_schedules?doctor_id=eq.' + encodeURIComponent(doctorId) +
        '&tenant_id=eq.' + encodeURIComponent(tenantId) +
        '&select=day_of_week,start_time,end_time,slot_duration_minutes,buffer_before_minutes,buffer_after_minutes,min_notice_hours,max_daily_bookings,session_number,is_working'),
      sbGet('/date_overrides?doctor_id=eq.' + encodeURIComponent(doctorId) +
        '&override_date=gte.' + dates[0] + '&override_date=lte.' + dates[6] +
        '&select=override_date,is_available,start_time,end_time,slot_duration_minutes'),
      sbGet('/doctor_leave?doctor_id=eq.' + encodeURIComponent(doctorId) +
        '&leave_date=gte.' + dates[0] + '&leave_date=lte.' + dates[6] + '&select=leave_date'),
      sbGet('/appointments?doctor_id=eq.' + encodeURIComponent(doctorId) +
        '&date=gte.' + dates[0] + '&date=lte.' + dates[6] +
        '&status=in.(confirmed,pending_payment,completed)' +
        (excludeApptId ? '&booking_id=neq.' + encodeURIComponent(excludeApptId) : '') +
        '&select=date,time'),
      patientPhone ? sbGet('/appointments?or=(patient_phone.eq.' + patientPhone +
        ',patient_phone.eq.%2B' + patientPhone + ')&date=gte.' + dates[0] +
        '&date=lte.' + dates[6] + '&status=in.(confirmed,pending_payment,completed)' +
        (excludeApptId ? '&booking_id=neq.' + encodeURIComponent(excludeApptId) : '') +
        '&select=date,time') : Promise.resolve([]),
      sbGet('/slot_locks?doctor_id=eq.' + encodeURIComponent(doctorId) +
        '&slot_date=gte.' + dates[0] + '&slot_date=lte.' + dates[6] +
        '&expires_at=gt.' + new Date().toISOString() + '&select=slot_date,slot_time'),
    ]);

    const leaveDates = new Set((leaves || []).map((l: any) => l.leave_date));
    const overrideMap: Record<string, any[]> = {};
    for (const o of (overrides || [])) {
      if (!overrideMap[o.override_date]) overrideMap[o.override_date] = [];
      overrideMap[o.override_date].push(o);
    }

    const bookedSet = new Set((bookedSlots || []).map((a: any) => a.date + '|' + a.time));
    const patientBusySet = new Set((patientSlots || []).map((a: any) => a.date + '|' + a.time));
    const lockSet = new Set((locks || []).map((l: any) => {
      const t = l.slot_time || '';
      const parts = t.split(':');
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1] || '0', 10);
      const ap = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      return l.slot_date + '|' + h12 + ':' + String(m).padStart(2, '0') + ' ' + ap;
    }));

    // Group schedules by day_of_week
    const scheduleMap: Record<number, any[]> = {};
    for (const s of (schedules || [])) {
      const dow = s.day_of_week;
      if (!scheduleMap[dow]) scheduleMap[dow] = [];
      scheduleMap[dow].push(s);
    }

    const hasSchedule = (schedules || []).length > 0;
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const availableDates: any[] = [];
    const slotsByDate: Record<string, any> = {};

    for (const dateStr of dates) {
      if (leaveDates.has(dateStr)) continue;

      const [yr, mo, dy] = dateStr.split('-').map(Number);
      // Use UTC noon to avoid timezone day-shift when calculating day-of-week
      const d = new Date(Date.UTC(yr, mo - 1, dy, 12, 0, 0));
      const dow = d.getUTCDay();
      const dateLabel = dy + ' ' + monthNames[mo - 1] + ' ' + yr;

      // Determine sessions for this day
      let sessions: { start: string; end: string; slotMin: number; minNotice: number; maxBookings: number }[] = [];

      if (overrideMap[dateStr]) {
        for (const o of overrideMap[dateStr]) {
          if (!o.is_available) { sessions = []; break; }
          sessions.push({
            start: o.start_time || '10:30', end: o.end_time || '21:00',
            slotMin: o.slot_duration_minutes || 20, minNotice: 0, maxBookings: 100,
          });
        }
        if (overrideMap[dateStr].some((o: any) => !o.is_available)) continue;
      } else if (hasSchedule) {
        const daySessions = scheduleMap[dow] || [];
        if (daySessions.length === 0 || daySessions.every((s: any) => !s.is_working)) continue;
        for (const s of daySessions) {
          if (!s.is_working) continue;
          sessions.push({
            start: s.start_time || '10:30', end: s.end_time || '21:00',
            slotMin: s.slot_duration_minutes || 20,
            minNotice: s.min_notice_hours || 0, maxBookings: s.max_daily_bookings || 100,
          });
        }
      } else {
        // Legacy fallback
        sessions = [{ start: '10:30', end: '21:00', slotMin: 20, minNotice: 0, maxBookings: 100 }];
      }

      if (sessions.length === 0) continue;

      const morning: any[] = [];
      const afternoon: any[] = [];
      const evening: any[] = [];
      let totalBooked = 0;

      // Count existing bookings for this date
      for (const key of Array.from(bookedSet)) {
        if ((key as string).startsWith(dateStr + '|')) totalBooked++;
      }

      const maxBookings = Math.max(...sessions.map(s => s.maxBookings));
      const minNotice = Math.max(...sessions.map(s => s.minNotice));

      for (const sess of sessions) {
        const [sh, sm] = sess.start.split(':').map(Number);
        const [eh, em] = sess.end.split(':').map(Number);
        let curMin = sh * 60 + sm;
        const endMin = eh * 60 + em;

        while (curMin < endMin) {
          const h24 = Math.floor(curMin / 60);
          const min = curMin % 60;
          const ap = h24 >= 12 ? 'PM' : 'AM';
          const h12 = h24 % 12 || 12;
          const timeStr = h12 + ':' + String(min).padStart(2, '0') + ' ' + ap;
          const slotKey = dateStr + '|' + timeStr;
          const isoTime = dateStr + 'T' + String(h24).padStart(2, '0') + ':' + String(min).padStart(2, '0') + ':00+05:30';

          // Skip past slots for today
          if (dateStr === ist.dateStr) {
            const slotMs = new Date(isoTime).getTime();
            const noticeMs = minNotice * 3600000;
            if (slotMs <= Date.now() + noticeMs) {
              curMin += sess.slotMin;
              continue;
            }
          }

          // Skip booked, locked, patient-busy
          if (!bookedSet.has(slotKey) && !lockSet.has(slotKey) && !patientBusySet.has(slotKey) && totalBooked < maxBookings) {
            const slot = { time: timeStr, capacity: 1, iso: isoTime };
            if (h24 < 12) morning.push(slot);
            else if (h24 < 17) afternoon.push(slot);
            else evening.push(slot);
          }

          curMin += sess.slotMin;
        }
      }

      const totalAvail = morning.length + afternoon.length + evening.length;
      if (totalAvail > 0) {
        availableDates.push({ date: dateLabel, date_key: dateStr, available_count: totalAvail });
        slotsByDate[dateLabel] = {
          morning, afternoon, evening,
          morning_count: morning.length, afternoon_count: afternoon.length, evening_count: evening.length,
          total: totalAvail,
        };
      }
    }

    return {
      success: true,
      available_dates: availableDates,
      slots_by_date: slotsByDate,
      total_dates: availableDates.length,
      instruction: 'Show dates with available counts. Let user pick date then time period then slot.',
    };
  } catch (e: any) {
    return { success: false, error: 'Availability check failed: ' + (e.message || 'Unknown') };
  }
}

// ==================== 5. BOOK APPOINTMENT ====================

export async function bookAppointment(args: any): Promise<any> {
  const tenantId = args.tenant_id || 'T001';
  const phone = normalizePhone(args.phone);
  const name = args.name || args.patient_name || 'Patient';
  const startTime = args.start_time;
  const doctorId = args.doctor_id || '';
  const doctorName = args.doctor_name || '';
  const specialty = args.specialty || 'General Medicine';
  const patientType = args.patient_type || 'SELF';
  const dependentId = args.dependent_id || null;
  const patientAge = args.age ? parseInt(args.age, 10) : null;
  const email = args.email || '';
  const excludeApptId = args.exclude_appointment_id || '';
  const source = args.source || 'whatsapp';
  let bookedBy = normalizePhone(args.booked_by_whatsapp_number || '');
  if (bookedBy.length === 10) bookedBy = '91' + bookedBy;

  const VALID_RELS = ['SELF', 'PARENT', 'SPOUSE', 'CHILD', 'FRIEND', 'OTHER'];
  let relationship = String(args.relationship_to_patient || 'SELF').toUpperCase();
  if (!VALID_RELS.includes(relationship)) relationship = 'OTHER';
  if (relationship === 'SELF' && bookedBy && phone !== bookedBy) relationship = 'OTHER';

  // WhatsApp config for sending confirmations
  const waApiUrl = args.wa_api_url || '';
  const waToken = args.wa_token || '';

  if (!startTime) return { success: false, error: 'start_time is required (YYYY-MM-DD HH:MM)' };
  if (!doctorId) return { success: false, error: 'doctor_id is required' };
  if (!phone || phone.length < 10) return { success: false, error: 'Valid phone number required' };

  // Parse time
  const parts = startTime.trim().split(/[\sT]+/);
  const dateStr = parts[0];
  const timeParts = (parts[1] || '10:00').split(':');
  const h24 = parseInt(timeParts[0], 10);
  const min = parseInt(timeParts[1] || '0', 10);
  const ap = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  const time = h12 + ':' + String(min).padStart(2, '0') + ' ' + ap;

  // Check future
  const istTimeStr = dateStr + 'T' + String(h24).padStart(2, '0') + ':' + String(min).padStart(2, '0') + ':00+05:30';
  if (new Date(istTimeStr).getTime() <= Date.now()) {
    return { success: false, error: 'Appointment must be in the future.' };
  }

  // Check patient exists
  try {
    const patients = await sbGet('/patients?phone=eq.' + phone + '&select=phone');
    if (!Array.isArray(patients) || patients.length === 0) {
      return { success: false, error: 'Patient not registered. Please register first.' };
    }
  } catch (e: any) {
    return { success: false, error: 'Could not verify patient: ' + e.message };
  }

  const bookingId = 'BK' + Date.now();
  const lockId = 'LOCK' + Date.now();
  const lockExpiry = new Date(Date.now() + 15 * 60 * 1000);

  // Lock slot
  try {
    await sbPost('/slot_locks', {
      lock_id: lockId, doctor_id: doctorId, slot_date: dateStr,
      slot_time: String(h24).padStart(2, '0') + ':' + String(min).padStart(2, '0') + ':00',
      booking_id: bookingId, expires_at: lockExpiry.toISOString(),
    });
  } catch (e: any) {
    const msg = e.message || '';
    if (msg.includes('23505') || msg.includes('unique') || msg.includes('duplicate')) {
      return { success: false, error: 'This slot is currently locked by another patient.' };
    }
    return { success: false, error: 'Could not lock slot: ' + msg };
  }

  // Check doctor conflicts
  try {
    const conflicts = await sbGet(
      '/appointments?doctor_id=eq.' + encodeURIComponent(doctorId) +
      '&date=eq.' + dateStr + '&time=eq.' + encodeURIComponent(time) +
      '&status=in.(confirmed,pending_payment,completed)' +
      (excludeApptId ? '&booking_id=neq.' + encodeURIComponent(excludeApptId) : '') +
      '&select=booking_id'
    );
    if (Array.isArray(conflicts) && conflicts.length > 0) {
      await sbDelete('/slot_locks?lock_id=eq.' + lockId);
      return { success: false, error: 'This slot was just booked. Please choose another time.' };
    }
  } catch {
    await sbDelete('/slot_locks?lock_id=eq.' + lockId);
    return { success: false, error: 'Could not verify slot availability.' };
  }

  // Save appointment
  const apptData: any = {
    booking_id: bookingId, patient_phone: phone, patient_name: name,
    patient_age: patientAge, doctor_id: doctorId, doctor_name: doctorName,
    specialty, date: dateStr, time, status: 'pending_payment',
    payment_status: 'unpaid', notes: args.notes || '',
    patient_type: patientType, dependent_id: dependentId,
    booked_by_whatsapp_number: bookedBy || phone,
    relationship_to_patient: relationship, source,
    tenant_id: tenantId, reschedule_count: 0,
  };

  try {
    await sbPost('/appointments', apptData);
  } catch (e: any) {
    await sbDelete('/slot_locks?lock_id=eq.' + lockId);
    return { success: false, error: 'Failed to save appointment: ' + e.message };
  }

  // Format date
  const [yr, mo, dy] = dateStr.split('-').map(Number);
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const dateObj = new Date(Date.UTC(yr, mo - 1, dy, 12, 0, 0));
  const formattedDate = dayNames[dateObj.getUTCDay()] + ', ' + dy + ' ' + months[mo - 1] + ' ' + yr;
  const consultationFee = 200;

  // Check OP Pass
  let hasValidPass = false;
  let passValidUntil = '';
  let opPassId = '';
  try {
    const passResult = await checkOpPass({
      patient_phone: phone, patient_name: name,
      patient_type: patientType, dependent_id: dependentId || '',
      tenant_id: tenantId,
    });
    hasValidPass = passResult.valid === true;
    passValidUntil = passResult.expiry_date || '';
    opPassId = passResult.op_pass_id || '';
  } catch { /* no pass */ }

  // Helper to send WhatsApp
  const sendWA = async (to: string, payload: any) => {
    if (!waApiUrl || !waToken) return;
    try {
      await fetch(waApiUrl, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + waToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to, ...payload }),
        signal: AbortSignal.timeout(15000),
      });
    } catch { /* non-critical */ }
  };

  // Create reminders helper
  const createReminders = async () => {
    const startIst = dateStr + 'T' + time.replace(/(\d+):(\d+)\s*(AM|PM)/i, (_m: string, h: string, mi: string, ampm: string) => {
      let hr = parseInt(h, 10);
      if (ampm.toUpperCase() === 'PM' && hr !== 12) hr += 12;
      if (ampm.toUpperCase() === 'AM' && hr === 12) hr = 0;
      return String(hr).padStart(2, '0') + ':' + mi + ':00';
    }) + '+05:30';
    const startMs = new Date(startIst).getTime();
    const reminders: any[] = [];
    const rem24 = startMs - 86400000;
    const rem2 = startMs - 7200000;
    if (rem24 > Date.now()) reminders.push({ id: bookingId + '_24h', patient_phone: phone, patient_name: name, appointment_date: dateStr, appointment_time: time, reminder_type: '24h', send_at: new Date(rem24).toISOString(), sent: 'no', booked_by_whatsapp_number: bookedBy, tenant_id: tenantId });
    if (rem2 > Date.now()) reminders.push({ id: bookingId + '_2h', patient_phone: phone, patient_name: name, appointment_date: dateStr, appointment_time: time, reminder_type: '2h', send_at: new Date(rem2).toISOString(), sent: 'no', booked_by_whatsapp_number: bookedBy, tenant_id: tenantId });
    if (reminders.length > 0) {
      try { await sbPost('/reminders', reminders); } catch { /* non-critical */ }
    }
  };

  // Fetch hospital name for card
  let hospitalName = 'Care Hospital';
  try {
    const tRows = await sbGet('/tenants?tenant_id=eq.' + encodeURIComponent(tenantId) + '&select=hospital_name');
    if (Array.isArray(tRows) && tRows.length > 0 && tRows[0].hospital_name) hospitalName = tRows[0].hospital_name;
  } catch { /* ok */ }
  const cleanDrName = (doctorName || '').replace(/^Dr\.?\s*/i, '').trim();

  // Generate appointment card image via html2img service
  const generateCardImage = async (qrUrl: string, refId: string, passId: string, expiryDisplay: string, amountText: string) => {
    const cardHtml = '<div style="width:800px;height:600px;font-family:Segoe UI,Roboto,Arial,sans-serif;display:flex;overflow:hidden">'
      + '<div style="flex:1;background:linear-gradient(170deg,#0f172a 0%,#1e293b 100%);display:flex;flex-direction:column">'
      + '<div style="padding:24px 28px 16px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,0.06)">'
      + '<div><div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:3px;font-weight:600">Appointment Pass</div>'
      + '<div style="font-size:22px;font-weight:800;color:#f8fafc;margin-top:2px">' + hospitalName + '</div></div>'
      + '<div style="background:#059669;color:#ecfdf5;padding:5px 16px;border-radius:6px;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">CONFIRMED</div></div>'
      + '<div style="padding:18px 28px;flex:1;display:flex;flex-direction:column;justify-content:center">'
      + '<div style="display:flex;margin-bottom:16px">'
      + '<div style="flex:1"><div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:2px;font-weight:600;margin-bottom:4px">Patient</div><div style="font-size:16px;font-weight:700;color:#f1f5f9">' + name + '</div></div>'
      + '<div style="flex:1"><div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:2px;font-weight:600;margin-bottom:4px">Doctor</div><div style="font-size:16px;font-weight:700;color:#f1f5f9">Dr. ' + cleanDrName + '</div></div></div>'
      + '<div style="display:flex;margin-bottom:16px">'
      + '<div style="flex:1"><div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:2px;font-weight:600;margin-bottom:4px">Department</div><div style="font-size:14px;font-weight:700;color:#f1f5f9">' + specialty + '</div></div>'
      + '<div style="flex:1"><div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:2px;font-weight:600;margin-bottom:4px">' + (amountText ? 'Amount' : '') + '</div><div style="font-size:20px;font-weight:800;color:#34d399">' + amountText + '</div></div></div>'
      + '<div style="height:1px;background:linear-gradient(90deg,#334155,transparent);margin-bottom:16px"></div>'
      + '<div style="display:flex;gap:12px">'
      + '<div style="flex:1;background:rgba(30,41,59,0.8);border-radius:10px;padding:12px 14px;border:1px solid #334155">'
      + '<div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:2px;font-weight:600;margin-bottom:4px">Date</div>'
      + '<div style="font-size:15px;font-weight:700;color:#f8fafc">' + formattedDate + '</div></div>'
      + '<div style="flex:0 0 120px;background:rgba(30,41,59,0.8);border-radius:10px;padding:12px 14px;border:1px solid #334155;text-align:center">'
      + '<div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:2px;font-weight:600;margin-bottom:4px">Time</div>'
      + '<div style="font-size:15px;font-weight:700;color:#f8fafc">' + time + '</div></div></div></div>'
      + '<div style="padding:10px 28px;background:rgba(2,6,23,0.5);border-top:1px solid rgba(255,255,255,0.04)">'
      + '<div style="font-size:10px;color:#475569;letter-spacing:0.5px">Present this pass at hospital reception</div></div></div>'
      + '<div style="width:28px;background:#0f172a;position:relative;flex-shrink:0">'
      + '<div style="position:absolute;top:-14px;left:50%;transform:translateX(-50%);width:28px;height:28px;background:#0f172a;border-radius:50%"></div>'
      + '<div style="position:absolute;bottom:-14px;left:50%;transform:translateX(-50%);width:28px;height:28px;background:#0f172a;border-radius:50%"></div>'
      + '<div style="position:absolute;top:28px;bottom:28px;left:50%;border-left:2px dashed #334155"></div></div>'
      + '<div style="width:220px;background:linear-gradient(170deg,#1e293b 0%,#0f172a 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;flex-shrink:0">'
      + '<div style="background:#ffffff;border-radius:10px;padding:8px;margin-bottom:16px">'
      + '<img src="' + qrUrl + '" width="130" height="130" style="display:block;border-radius:4px" /></div>'
      + '<div style="text-align:center;margin-bottom:10px;width:100%">'
      + '<div style="font-size:8px;color:#64748b;text-transform:uppercase;letter-spacing:2px;font-weight:600;margin-bottom:2px">Booking ID</div>'
      + '<div style="font-size:12px;font-weight:700;color:#e2e8f0;font-family:monospace">' + refId + '</div></div>'
      + (passId ? '<div style="text-align:center;margin-bottom:10px;width:100%"><div style="font-size:8px;color:#64748b;text-transform:uppercase;letter-spacing:2px;font-weight:600;margin-bottom:2px">OP Pass</div><div style="font-size:12px;font-weight:700;color:#e2e8f0;font-family:monospace">' + passId + '</div></div>' : '')
      + (expiryDisplay ? '<div style="text-align:center;width:100%"><div style="font-size:8px;color:#64748b;text-transform:uppercase;letter-spacing:2px;font-weight:600;margin-bottom:2px">Valid Until</div><div style="font-size:13px;font-weight:700;color:#fbbf24">' + expiryDisplay + '</div></div>' : '')
      + '</div></div>';
    try {
      const imgRes = await fetch('http://html2img:3000/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: cardHtml, vw: 800, vh: 600 }),
        signal: AbortSignal.timeout(20000),
      });
      if (imgRes.ok) {
        const imgData = await imgRes.json();
        if (imgData && imgData.url) return imgData.url;
      }
    } catch { /* fallback to plain QR */ }
    return qrUrl;
  };

  // ===== OP PASS PATH =====
  if (hasValidPass) {
    const verifyUrl = 'https://ainewworld.in/webhook/verify-appointment?id=' + encodeURIComponent(opPassId);
    const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(verifyUrl);
    const expiryDisplay = passValidUntil ? new Date(passValidUntil + 'T00:00:00+05:30').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

    try {
      await sbPatch('/appointments?booking_id=eq.' + encodeURIComponent(bookingId), {
        status: 'confirmed', payment_status: 'paid', payment_id: 'OP_PASS', op_pass_id: opPassId, source,
      });
    } catch { /* continue */ }

    try { await sbDelete('/slot_locks?lock_id=eq.' + lockId); } catch { /* ok */ }
    await createReminders();

    // Generate card image (same design as payment confirmation)
    const cardImageUrl = await generateCardImage(qrUrl, bookingId, opPassId, expiryDisplay, 'OP Pass');

    const caption = '*' + hospitalName + '*\nAppointment Confirmed\n\n*Patient:* ' + name + '\n*Doctor:* Dr. ' + cleanDrName + '\n*Department:* ' + specialty + '\n*Date:* ' + formattedDate + '\n*Time:* ' + time + '\n\n*Booking ID:* ' + bookingId + '\n*OP Pass:* ' + opPassId + '\n*Valid Until:* ' + expiryDisplay + '\n\n_No payment needed (OP Pass active)._\n_Present this digital pass at reception._';
    await sendWA(phone, { type: 'image', image: { link: cardImageUrl, caption } });
    if (bookedBy && bookedBy !== phone) {
      await sendWA(bookedBy, { type: 'image', image: { link: cardImageUrl, caption: '*' + hospitalName + '*\nBooking Confirmed for ' + name + '\n\n*Doctor:* Dr. ' + cleanDrName + '\n*Date:* ' + formattedDate + '\n*Time:* ' + time + '\n*Booking ID:* ' + bookingId + '\n\n_Present this pass at reception._' } });
    }

    return {
      success: true, booking_id: bookingId, date: formattedDate, time,
      patient_name: name, doctor_name: doctorName, specialty,
      payment_required: false, payment_link: '', op_pass_id: opPassId,
      pass_valid_until: passValidUntil,
      message: 'Appointment confirmed. OP Pass valid until ' + passValidUntil + ' — no payment needed.',
    };
  }

  // ===== WALK-IN PATH =====
  if (source === 'reception_walkin') {
    try {
      await sbPatch('/appointments?booking_id=eq.' + encodeURIComponent(bookingId), {
        status: 'confirmed', payment_status: 'pay_at_counter', source,
      });
    } catch { /* continue */ }
    try { await sbDelete('/slot_locks?lock_id=eq.' + lockId); } catch { /* ok */ }
    await createReminders();

    const verifyUrl = 'https://ainewworld.in/webhook/verify-appointment?id=' + encodeURIComponent(bookingId);
    const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(verifyUrl);
    const cardImageUrl = await generateCardImage(qrUrl, bookingId, '', '', 'Pay at Counter');

    const caption = '*' + hospitalName + '*\nAppointment Confirmed\n\n*Patient:* ' + name + '\n*Doctor:* Dr. ' + cleanDrName + '\n*Date:* ' + formattedDate + '\n*Time:* ' + time + '\n*Booking ID:* ' + bookingId + '\n\n_Please arrive 10 minutes early._\n_Present this pass at reception._';
    await sendWA(phone, { type: 'image', image: { link: cardImageUrl, caption } });

    return {
      success: true, booking_id: bookingId, date: formattedDate, time,
      patient_name: name, doctor_name: doctorName, specialty,
      payment_required: false, payment_link: '',
      message: 'Appointment confirmed. Payment at counter.',
    };
  }

  // ===== ONLINE PAYMENT PATH =====
  let paymentLinkUrl = '';
  let paymentLinkId = '';
  try {
    const rzpAuth = 'Basic ' + (process.env.RAZORPAY_AUTH || '');
    const payload = {
      amount: consultationFee * 100, currency: 'INR', accept_partial: false,
      description: 'Consultation - ' + doctorName + ' (' + specialty + ')',
      customer: { name, contact: '+' + phone },
      notify: { sms: false, email: false }, reminder_enable: false,
      notes: { type: 'appointment', reference_id: bookingId, patient_name: name, patient_phone: phone, doctor_name: doctorName, specialty, appointment_date: formattedDate, appointment_time: time, tenant_id: tenantId },
      callback_url: (process.env.NEXT_PUBLIC_APP_URL || 'https://app.ainewworld.in') + '/api/payment/callback',
      callback_method: 'get',
      expire_by: Math.floor(Date.now() / 1000) + 1200,
    };
    const rzpRes = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: { 'Authorization': rzpAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    if (rzpRes.ok) {
      const rzpData = await rzpRes.json();
      paymentLinkUrl = rzpData.short_url || '';
      paymentLinkId = rzpData.id || '';
      if (paymentLinkUrl) {
        try {
          await sbPatch('/appointments?booking_id=eq.' + encodeURIComponent(bookingId), {
            payment_link: paymentLinkUrl, payment_id: paymentLinkId, source,
          });
        } catch { /* ok */ }
      }
    }
  } catch { /* payment link creation failed */ }

  return {
    success: true, booking_id: bookingId, date: formattedDate, time,
    patient_name: name, doctor_name: doctorName, specialty,
    consultation_fee: consultationFee, payment_required: true,
    payment_link: paymentLinkUrl, payment_link_id: paymentLinkId,
    locked_until: lockExpiry.toISOString(),
    message: paymentLinkUrl
      ? 'Appointment reserved. Fee: Rs ' + consultationFee + '. Complete payment within 20 minutes.'
      : 'Appointment reserved but payment link could not be generated.',
  };
}

// ==================== 6. CANCEL APPOINTMENT ====================

export async function cancelAppointment(args: any): Promise<any> {
  const tenantId = args.tenant_id || 'T001';
  const bookingId = args.booking_id;
  const senderPhone = normalizePhone(args.sender_phone || '');
  const reason = args.reason || 'Cancelled by patient via WhatsApp';

  if (!bookingId) return { success: false, error: 'booking_id is required' };

  try {
    const appts = await sbGet(
      '/appointments?booking_id=eq.' + encodeURIComponent(bookingId) +
      '&status=in.(confirmed,pending_payment)&select=*'
    );
    if (!Array.isArray(appts) || appts.length === 0) {
      return { success: false, error: 'No active appointment found with this booking ID.' };
    }
    const appt = appts[0];

    // Auth check
    if (senderPhone) {
      const apptPhone = normalizePhone(appt.patient_phone || '');
      const apptBookedBy = normalizePhone(appt.booked_by_whatsapp_number || '');
      if (senderPhone !== apptPhone && senderPhone !== apptBookedBy && apptBookedBy) {
        return { success: false, error: 'You are not authorized to cancel this appointment.' };
      }
    }

    // Cancel
    await sbPatch('/appointments?booking_id=eq.' + encodeURIComponent(bookingId), { status: 'cancelled' });

    // Skip reminders
    try { await sbPatch('/reminders?id=like.' + encodeURIComponent(bookingId) + '*&sent=eq.no', { sent: 'skipped' }); } catch { /* ok */ }

    // Release lock
    try { await sbDelete('/slot_locks?booking_id=eq.' + encodeURIComponent(bookingId)); } catch { /* ok */ }

    // Check OP pass
    let opPassStatus = '';
    let opPassExpiry = '';
    const opPassId = appt.op_pass_id || '';
    if (opPassId) {
      try {
        const passes = await sbGet('/op_passes?op_pass_id=eq.' + encodeURIComponent(opPassId) + '&select=status,expiry_date');
        if (Array.isArray(passes) && passes.length > 0) {
          opPassStatus = passes[0].status || '';
          opPassExpiry = passes[0].expiry_date || '';
        }
      } catch { /* ok */ }
    }

    return {
      success: true, cancelled_booking_id: bookingId, reason,
      was_paid: appt.payment_status === 'paid',
      op_pass_id: opPassId, op_pass_status: opPassStatus, op_pass_expiry: opPassExpiry,
      reschedules_remaining: opPassId ? 5 - (appt.reschedule_count || 0) : 0,
      message: opPassId && opPassStatus === 'ACTIVE'
        ? 'Appointment cancelled. Your OP Pass (' + opPassId + ') is still active until ' + opPassExpiry + '. You can reschedule for free.'
        : 'Appointment cancelled successfully.',
    };
  } catch (e: any) {
    return { success: false, error: 'Cancel failed: ' + (e.message || 'Unknown') };
  }
}

// ==================== 7. LIST APPOINTMENTS ====================

export async function listAppointments(args: any): Promise<any> {
  const tenantId = args.tenant_id || 'T001';
  const phone = normalizePhone(args.phone);
  if (!phone) return { success: false, appointments: [], message: 'Phone number is required' };

  try {
    const result = await sbGet(
      '/appointments?or=(patient_phone.eq.' + phone + ',patient_phone.eq.%2B' + phone +
      ',booked_by_whatsapp_number.eq.' + phone + ',booked_by_whatsapp_number.eq.%2B' + phone +
      ')&tenant_id=eq.' + encodeURIComponent(tenantId) +
      '&status=in.(confirmed,pending_payment)&order=date.asc,time.asc'
    );
    let appointments = Array.isArray(result) ? result : [];
    if (appointments.length === 0) {
      return { success: true, appointments: [], count: 0, message: 'No active appointments found.' };
    }

    // Dedup
    const seen = new Set<string>();
    appointments = appointments.filter(a => {
      if (seen.has(a.booking_id)) return false;
      seen.add(a.booking_id);
      return true;
    });

    // Fetch OP passes
    const opPassIds = [...new Set(appointments.map(a => a.op_pass_id).filter(Boolean))];
    const opPassMap: Record<string, any> = {};
    if (opPassIds.length > 0) {
      try {
        const passes = await sbGet('/op_passes?op_pass_id=in.(' + opPassIds.map(id => encodeURIComponent(id)).join(',') + ')&select=op_pass_id,expiry_date,status');
        if (Array.isArray(passes)) for (const p of passes) opPassMap[p.op_pass_id] = p;
      } catch { /* ok */ }
    }

    const list = appointments.map((a, i) => {
      const op = opPassMap[a.op_pass_id] || {};
      return {
        index: i + 1, booking_id: a.booking_id || '', patient_name: a.patient_name || '',
        patient_phone: a.patient_phone || '', patient_age: a.patient_age || null,
        patient_type: a.patient_type || 'SELF',
        booked_by_whatsapp_number: a.booked_by_whatsapp_number || '',
        relationship_to_patient: a.relationship_to_patient || 'SELF',
        dependent_id: a.dependent_id || null,
        doctor_name: a.doctor_name || '', specialty: a.specialty || '',
        date: a.date || '', time: a.time || '', status: a.status || 'confirmed',
        payment_status: a.payment_status || '',
        op_pass_id: a.op_pass_id || '', op_pass_expiry: op.expiry_date || '',
        op_pass_status: op.status || '', reschedule_count: a.reschedule_count || 0,
      };
    });

    return { success: true, appointments: list, count: list.length, message: list.length + ' appointment(s) found.' };
  } catch (e: any) {
    return { success: false, appointments: [], count: 0, message: 'Query failed: ' + e.message };
  }
}

// ==================== 8. CHECK OP PASS ====================

export async function checkOpPass(args: any): Promise<any> {
  const phone = normalizePhone(args.patient_phone || args.phone || '');
  const opPassIdInput = args.op_pass_id || '';
  const dependentId = args.dependent_id || '';

  if (!phone && !opPassIdInput) {
    return { valid: false, op_pass_id: '', expiry_date: '', reschedules_remaining: 0, status: 'NONE', message: 'No phone or OP pass ID provided.' };
  }

  try {
    let url: string;
    if (opPassIdInput) {
      url = '/op_passes?op_pass_id=eq.' + encodeURIComponent(opPassIdInput) + '&select=*';
    } else {
      url = '/op_passes?patient_phone=like.*' + phone + '*&status=eq.ACTIVE&order=created_at.desc&select=*';
      if (dependentId) url += '&dependent_id=eq.' + encodeURIComponent(dependentId);
      else url += '&or=(patient_type.eq.SELF,dependent_id.is.null)';
    }

    const rows = await sbGet(url);
    if (!Array.isArray(rows) || rows.length === 0) {
      return { valid: false, op_pass_id: '', expiry_date: '', reschedules_remaining: 0, status: 'NONE', message: 'No active OP Pass found for this patient.' };
    }

    const ist = nowIST();
    for (const pass of rows) {
      if (pass.status !== 'ACTIVE') continue;
      if (!pass.expiry_date || ist.dateStr > pass.expiry_date) continue;

      let rescheduleCount = 0;
      if (pass.booking_id) {
        try {
          const appts = await sbGet('/appointments?booking_id=eq.' + encodeURIComponent(pass.booking_id) + '&select=reschedule_count');
          if (Array.isArray(appts) && appts.length > 0) rescheduleCount = appts[0].reschedule_count || 0;
        } catch { /* 0 */ }
      }

      return {
        valid: true, op_pass_id: pass.op_pass_id, booking_id: pass.booking_id || '',
        patient_name: pass.patient_name || '', patient_type: pass.patient_type || 'SELF',
        expiry_date: pass.expiry_date, reschedules_remaining: 5 - rescheduleCount,
        reschedule_count: rescheduleCount, status: 'ACTIVE',
      };
    }

    return {
      valid: false, op_pass_id: rows[0].op_pass_id || '', expiry_date: rows[0].expiry_date || '',
      reschedules_remaining: 0, status: 'EXPIRED', message: 'OP Pass has expired. New payment required.',
    };
  } catch {
    return { valid: false, op_pass_id: '', expiry_date: '', reschedules_remaining: 0, status: 'NONE', message: 'Could not check OP Pass.' };
  }
}

// ==================== 9. RESCHEDULE APPOINTMENT ====================

export async function rescheduleAppointment(args: any): Promise<any> {
  const tenantId = args.tenant_id || 'T001';
  const oldBookingId = args.old_booking_id || args.booking_id;
  const senderPhone = normalizePhone(args.sender_phone || '');
  const newDoctorId = args.new_doctor_id || args.doctor_id;
  const newDoctorName = args.new_doctor_name || args.doctor_name || '';
  const newSpecialty = args.new_specialty || args.specialty || '';
  const waApiUrl = args.wa_api_url || '';
  const waToken = args.wa_token || '';

  let newStartTime = args.new_start_time || args.start_time || '';
  if (!newStartTime && args.new_date && args.new_time) {
    newStartTime = args.new_date + ' ' + args.new_time;
  }

  if (!oldBookingId) return { success: false, error: 'old_booking_id is required' };
  if (!newDoctorId) return { success: false, error: 'doctor_id is required' };
  if (!newStartTime) return { success: false, error: 'new start_time is required' };

  try {
    // Get old appointment
    const oldAppts = await sbGet('/appointments?booking_id=eq.' + encodeURIComponent(oldBookingId) + '&status=eq.confirmed&select=*');
    if (!Array.isArray(oldAppts) || oldAppts.length === 0) {
      return { success: false, error: 'No confirmed appointment found with this booking ID.' };
    }
    const old = oldAppts[0];

    // Auth check
    if (senderPhone) {
      const apptPhone = normalizePhone(old.patient_phone || '');
      const apptBookedBy = normalizePhone(old.booked_by_whatsapp_number || '');
      if (senderPhone !== apptPhone && senderPhone !== apptBookedBy && apptBookedBy) {
        return { success: false, error: 'Not authorized to reschedule this appointment.' };
      }
    }

    // Check OP Pass
    const opPassId = old.op_pass_id || '';
    if (!opPassId) return { success: false, error: 'Rescheduling requires an active OP Pass. Please cancel and book a new appointment.' };

    const passResult = await checkOpPass({ op_pass_id: opPassId });
    if (!passResult.valid) return { success: false, error: 'OP Pass is not valid: ' + (passResult.message || 'Expired or inactive') };

    const rescheduleCount = old.reschedule_count || 0;
    if (rescheduleCount >= 5) return { success: false, error: 'Maximum 5 reschedules reached. Please cancel and book a new appointment.' };

    // Book new slot (reuse bookAppointment with exclude)
    const bookResult = await bookAppointment({
      phone: old.patient_phone, name: old.patient_name, age: old.patient_age,
      email: old.email || '', start_time: newStartTime,
      doctor_id: newDoctorId, doctor_name: newDoctorName, specialty: newSpecialty,
      booked_by_whatsapp_number: old.booked_by_whatsapp_number || senderPhone,
      relationship_to_patient: old.relationship_to_patient || 'SELF',
      patient_type: old.patient_type || 'SELF', dependent_id: old.dependent_id,
      exclude_appointment_id: oldBookingId, source: 'whatsapp',
      tenant_id: tenantId, wa_api_url: waApiUrl, wa_token: waToken,
    });

    if (!bookResult.success) return { success: false, error: 'Could not book new slot: ' + bookResult.error };

    const newBookingId = bookResult.booking_id;
    const newRescheduleCount = rescheduleCount + 1;

    // Confirm new appointment with OP pass
    try {
      await sbPatch('/appointments?booking_id=eq.' + encodeURIComponent(newBookingId), {
        status: 'confirmed', payment_status: 'paid', payment_id: 'OP_PASS_RESCHED',
        op_pass_id: opPassId, reschedule_count: newRescheduleCount,
      });
    } catch { /* ok */ }

    // Release new lock
    try { await sbDelete('/slot_locks?booking_id=eq.' + encodeURIComponent(newBookingId)); } catch { /* ok */ }

    // Update OP pass to point to new booking
    try { await sbPatch('/op_passes?op_pass_id=eq.' + encodeURIComponent(opPassId), { booking_id: newBookingId }); } catch { /* ok */ }

    // Cancel old appointment
    try { await sbPatch('/appointments?booking_id=eq.' + encodeURIComponent(oldBookingId), { status: 'cancelled' }); } catch { /* ok */ }
    try { await sbDelete('/slot_locks?booking_id=eq.' + encodeURIComponent(oldBookingId)); } catch { /* ok */ }
    try { await sbPatch('/reminders?id=like.' + encodeURIComponent(oldBookingId) + '*&sent=eq.no', { sent: 'skipped' }); } catch { /* ok */ }

    return {
      success: true, old_booking_id: oldBookingId, new_booking_id: newBookingId,
      op_pass_id: opPassId, reschedule_count: newRescheduleCount,
      reschedules_remaining: 5 - newRescheduleCount,
      date: bookResult.date, time: bookResult.time,
      doctor_name: newDoctorName, specialty: newSpecialty,
      message: 'Appointment rescheduled successfully. Reschedules remaining: ' + (5 - newRescheduleCount),
    };
  } catch (e: any) {
    return { success: false, error: 'Reschedule failed: ' + (e.message || 'Unknown') };
  }
}

// ==================== 10. SAVE DEPENDENT ====================

export async function saveDependent(args: any): Promise<any> {
  const linkedPhone = normalizePhone(args.linked_phone || args.phone || '');
  if (!linkedPhone || linkedPhone.length < 10) return { success: false, message: 'Valid linked_phone (10+ digits) is required' };
  if (!args.name) return { success: false, message: 'Dependent name is required' };

  const depId = 'DEP' + Date.now();
  try {
    await sbPost('/dependents', {
      dependent_id: depId, linked_phone: linkedPhone, name: args.name,
      age: args.age !== undefined ? parseInt(args.age, 10) : null,
      address: args.address || null, reason: args.reason || null,
    });
    return { success: true, dependent_id: depId, name: args.name, age: args.age || null, message: 'Dependent saved successfully' };
  } catch (e: any) {
    const msg = e.message || '';
    if (msg.includes('23503')) return { success: false, message: 'Primary patient must be registered first.' };
    return { success: false, message: 'Failed to save dependent: ' + msg };
  }
}
