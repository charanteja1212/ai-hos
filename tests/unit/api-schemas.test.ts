import { describe, it, expect } from 'vitest'
import {
  phoneSchema,
  flexPhoneSchema,
  dateSchema,
  timeSchema,
  emailSchema,
  safeTextSchema,
  bookingIdSchema,
  tenantIdSchema,
  doctorIdSchema,
  uuidSchema,
  bookAppointmentSchema,
  cancelAppointmentSchema,
  checkAvailabilitySchema,
  patientLookupSchema,
  savePatientSchema,
  listSpecialtiesSchema,
  bookingActionSchema,
  waActionSchema,
  sendOtpSchema,
  createOrderBodySchema,
  paymentStatusQuerySchema,
  verifyCheckoutBodySchema,
  sendEmailsBodySchema,
  createPasswordBodySchema,
  forgotPasswordBodySchema,
  doctorLeaveBodySchema,
  postConsultationBodySchema,
  patientBookingActionSchema,
  patientAppointmentBodySchema,
  agentReplyBodySchema,
  telemedicineSendLinkBodySchema,
  queueNotifyBodySchema,
  pushSubscribeBodySchema,
  abdmActionSchema,
  platformScopeSchema,
  platformPostBodySchema,
  validateBody,
  createOrderSchema,
} from '@/lib/validations/api-schemas'

// ─── Reusable Primitives ────────────────────────────────────────────────────

describe('Reusable Primitive Schemas', () => {
  describe('phoneSchema', () => {
    it('should accept valid 10-digit phone', () => {
      expect(phoneSchema.safeParse('9876543210').success).toBe(true)
    })

    it('should accept valid 12-digit phone with country code', () => {
      expect(phoneSchema.safeParse('919876543210').success).toBe(true)
    })

    it('should accept 15-digit phone (max)', () => {
      expect(phoneSchema.safeParse('123456789012345').success).toBe(true)
    })

    it('should reject short phone number', () => {
      expect(phoneSchema.safeParse('12345').success).toBe(false)
    })

    it('should reject 16+ digit phone', () => {
      expect(phoneSchema.safeParse('1234567890123456').success).toBe(false)
    })

    it('should reject phone with letters', () => {
      expect(phoneSchema.safeParse('98765abc10').success).toBe(false)
    })

    it('should reject phone with spaces', () => {
      expect(phoneSchema.safeParse('987 654 3210').success).toBe(false)
    })

    it('should reject phone with dashes', () => {
      expect(phoneSchema.safeParse('987-654-3210').success).toBe(false)
    })

    it('should reject phone with + prefix', () => {
      expect(phoneSchema.safeParse('+919876543210').success).toBe(false)
    })

    it('should reject empty string', () => {
      expect(phoneSchema.safeParse('').success).toBe(false)
    })
  })

  describe('flexPhoneSchema', () => {
    it('should accept any non-empty string', () => {
      expect(flexPhoneSchema.safeParse('9876543210').success).toBe(true)
      expect(flexPhoneSchema.safeParse('+91 98765 43210').success).toBe(true)
      expect(flexPhoneSchema.safeParse('098-765-43210').success).toBe(true)
    })

    it('should reject empty string', () => {
      expect(flexPhoneSchema.safeParse('').success).toBe(false)
    })
  })

  describe('dateSchema', () => {
    it('should accept YYYY-MM-DD format', () => {
      expect(dateSchema.safeParse('2026-03-19').success).toBe(true)
    })

    it('should accept boundary dates', () => {
      expect(dateSchema.safeParse('2000-01-01').success).toBe(true)
      expect(dateSchema.safeParse('2099-12-31').success).toBe(true)
    })

    it('should reject DD-MM-YYYY format', () => {
      expect(dateSchema.safeParse('19-03-2026').success).toBe(false)
    })

    it('should reject MM/DD/YYYY format', () => {
      expect(dateSchema.safeParse('03/19/2026').success).toBe(false)
    })

    it('should reject invalid date that passes regex', () => {
      // 2026-02-30 matches YYYY-MM-DD regex but is not a valid date
      // Note: Date.parse may accept some "invalid" dates depending on engine
      // This tests the refine step
      const result = dateSchema.safeParse('2026-13-45')
      expect(result.success).toBe(false)
    })

    it('should reject empty string', () => {
      expect(dateSchema.safeParse('').success).toBe(false)
    })

    it('should reject random text', () => {
      expect(dateSchema.safeParse('not-a-date').success).toBe(false)
    })
  })

  describe('timeSchema', () => {
    it('should accept 09:30', () => {
      expect(timeSchema.safeParse('09:30').success).toBe(true)
    })

    it('should accept 23:59', () => {
      expect(timeSchema.safeParse('23:59').success).toBe(true)
    })

    it('should accept 00:00', () => {
      expect(timeSchema.safeParse('00:00').success).toBe(true)
    })

    it('should accept single-digit hour 9:30', () => {
      expect(timeSchema.safeParse('9:30').success).toBe(true)
    })

    it('should reject 25:00', () => {
      expect(timeSchema.safeParse('25:00').success).toBe(false)
    })

    it('should reject 24:00', () => {
      expect(timeSchema.safeParse('24:00').success).toBe(false)
    })

    it('should reject time with seconds', () => {
      expect(timeSchema.safeParse('09:30:00').success).toBe(false)
    })

    it('should reject empty string', () => {
      expect(timeSchema.safeParse('').success).toBe(false)
    })

    it('should reject invalid minutes 09:60', () => {
      expect(timeSchema.safeParse('09:60').success).toBe(false)
    })
  })

  describe('emailSchema', () => {
    it('should accept valid email', () => {
      const result = emailSchema.safeParse('Test@Example.COM')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe('test@example.com') // lowercased + trimmed
      }
    })

    it('should reject email with leading/trailing spaces (validated before trim)', () => {
      // Zod validates email format before applying .trim(), so spaces cause failure
      expect(emailSchema.safeParse('  user@test.com  ').success).toBe(false)
    })

    it('should reject invalid email', () => {
      expect(emailSchema.safeParse('not-an-email').success).toBe(false)
    })

    it('should reject email without domain', () => {
      expect(emailSchema.safeParse('user@').success).toBe(false)
    })

    it('should reject empty string', () => {
      expect(emailSchema.safeParse('').success).toBe(false)
    })

    it('should reject email longer than 254 chars', () => {
      const longEmail = 'a'.repeat(250) + '@b.com'
      expect(emailSchema.safeParse(longEmail).success).toBe(false)
    })
  })

  describe('safeTextSchema', () => {
    it('should strip HTML tags', () => {
      const schema = safeTextSchema(100)
      const result = schema.safeParse('Hello <script>alert("xss")</script> World')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe('Hello alert("xss") World')
      }
    })

    it('should strip nested HTML', () => {
      const schema = safeTextSchema(200)
      const result = schema.safeParse('<div><b>Bold</b> and <i>italic</i></div>')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe('Bold and italic')
      }
    })

    it('should enforce max length', () => {
      const schema = safeTextSchema(10)
      expect(schema.safeParse('a'.repeat(11)).success).toBe(false)
    })

    it('should allow text within limit', () => {
      const schema = safeTextSchema(10)
      expect(schema.safeParse('hello').success).toBe(true)
    })

    it('should allow empty string', () => {
      const schema = safeTextSchema(10)
      expect(schema.safeParse('').success).toBe(true)
    })
  })

  describe('bookingIdSchema', () => {
    it('should accept valid booking ID', () => {
      expect(bookingIdSchema.safeParse('BK-2026-001').success).toBe(true)
    })

    it('should trim whitespace', () => {
      const result = bookingIdSchema.safeParse('  BK-001  ')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe('BK-001')
      }
    })

    it('should reject empty string', () => {
      expect(bookingIdSchema.safeParse('').success).toBe(false)
    })

    it('should reject string > 60 chars', () => {
      expect(bookingIdSchema.safeParse('x'.repeat(61)).success).toBe(false)
    })
  })

  describe('tenantIdSchema', () => {
    it('should accept valid tenant ID', () => {
      expect(tenantIdSchema.safeParse('tenant-1').success).toBe(true)
    })

    it('should reject empty string', () => {
      expect(tenantIdSchema.safeParse('').success).toBe(false)
    })

    it('should reject string > 30 chars', () => {
      expect(tenantIdSchema.safeParse('x'.repeat(31)).success).toBe(false)
    })
  })

  describe('doctorIdSchema', () => {
    it('should accept valid doctor ID', () => {
      expect(doctorIdSchema.safeParse('doc-123').success).toBe(true)
    })

    it('should reject empty string', () => {
      expect(doctorIdSchema.safeParse('').success).toBe(false)
    })

    it('should reject string > 60 chars', () => {
      expect(doctorIdSchema.safeParse('x'.repeat(61)).success).toBe(false)
    })
  })

  describe('uuidSchema', () => {
    it('should accept valid UUID v4', () => {
      expect(uuidSchema.safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBe(true)
    })

    it('should reject invalid UUID', () => {
      expect(uuidSchema.safeParse('not-a-uuid').success).toBe(false)
    })

    it('should reject empty string', () => {
      expect(uuidSchema.safeParse('').success).toBe(false)
    })
  })
})

// ─── Booking Action Schemas ─────────────────────────────────────────────────

describe('Booking Action Schemas', () => {
  describe('bookAppointmentSchema', () => {
    const validBooking = {
      action: 'book-appointment',
      doctor_id: 'doc-1',
      doctor_name: 'Dr. Smith',
      patient_name: 'John Doe',
      patient_phone: '9876543210',
      date: '2026-04-01',
      time: '10:30',
    }

    it('should accept valid booking', () => {
      expect(bookAppointmentSchema.safeParse(validBooking).success).toBe(true)
    })

    it('should accept booking with all optional fields', () => {
      const full = {
        ...validBooking,
        specialty: 'Cardiology',
        patient_type: 'DEPENDENT',
        dependent_id: 'dep-1',
        patient_age: 45,
        patient_gender: 'Male',
        source: 'whatsapp',
        booked_by_whatsapp_number: '9876543210',
      }
      expect(bookAppointmentSchema.safeParse(full).success).toBe(true)
    })

    it('should default patient_type to SELF', () => {
      const result = bookAppointmentSchema.safeParse(validBooking)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.patient_type).toBe('SELF')
      }
    })

    it('should reject invalid patient_type', () => {
      expect(bookAppointmentSchema.safeParse({ ...validBooking, patient_type: 'FRIEND' }).success).toBe(false)
    })

    it('should reject missing doctor_id', () => {
      const { doctor_id, ...rest } = validBooking
      expect(bookAppointmentSchema.safeParse(rest).success).toBe(false)
    })

    it('should reject missing patient_phone', () => {
      const { patient_phone, ...rest } = validBooking
      expect(bookAppointmentSchema.safeParse(rest).success).toBe(false)
    })

    it('should reject invalid date format', () => {
      expect(bookAppointmentSchema.safeParse({ ...validBooking, date: '01-04-2026' }).success).toBe(false)
    })

    it('should reject invalid time format', () => {
      expect(bookAppointmentSchema.safeParse({ ...validBooking, time: '25:00' }).success).toBe(false)
    })

    it('should reject patient_age > 150', () => {
      expect(bookAppointmentSchema.safeParse({ ...validBooking, patient_age: 200 }).success).toBe(false)
    })

    it('should reject patient_age < 0', () => {
      expect(bookAppointmentSchema.safeParse({ ...validBooking, patient_age: -1 }).success).toBe(false)
    })

    it('should accept patient_age as null', () => {
      expect(bookAppointmentSchema.safeParse({ ...validBooking, patient_age: null }).success).toBe(true)
    })

    it('should reject invalid patient_gender', () => {
      expect(bookAppointmentSchema.safeParse({ ...validBooking, patient_gender: 'Unknown' }).success).toBe(false)
    })

    it('should accept all valid genders', () => {
      for (const gender of ['Male', 'Female', 'Other']) {
        expect(bookAppointmentSchema.safeParse({ ...validBooking, patient_gender: gender }).success).toBe(true)
      }
    })
  })

  describe('cancelAppointmentSchema', () => {
    it('should accept valid cancellation', () => {
      const result = cancelAppointmentSchema.safeParse({
        action: 'cancel-appointment',
        booking_id: 'BK-001',
      })
      expect(result.success).toBe(true)
    })

    it('should accept cancellation with optional phone', () => {
      const result = cancelAppointmentSchema.safeParse({
        action: 'cancel-appointment',
        booking_id: 'BK-001',
        patient_phone: '9876543210',
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing booking_id', () => {
      const result = cancelAppointmentSchema.safeParse({
        action: 'cancel-appointment',
      })
      expect(result.success).toBe(false)
    })

    it('should reject empty booking_id', () => {
      const result = cancelAppointmentSchema.safeParse({
        action: 'cancel-appointment',
        booking_id: '',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('checkAvailabilitySchema', () => {
    it('should accept with doctor_id', () => {
      expect(checkAvailabilitySchema.safeParse({
        action: 'check-availability',
        doctor_id: 'doc-1',
      }).success).toBe(true)
    })

    it('should accept with specialty', () => {
      expect(checkAvailabilitySchema.safeParse({
        action: 'check-availability',
        specialty: 'Dermatology',
      }).success).toBe(true)
    })

    it('should accept with no optional fields', () => {
      expect(checkAvailabilitySchema.safeParse({
        action: 'check-availability',
      }).success).toBe(true)
    })
  })

  describe('patientLookupSchema', () => {
    it('should accept valid phone', () => {
      expect(patientLookupSchema.safeParse({
        action: 'patient-lookup',
        phone: '9876543210',
      }).success).toBe(true)
    })

    it('should reject invalid phone', () => {
      expect(patientLookupSchema.safeParse({
        action: 'patient-lookup',
        phone: 'abc',
      }).success).toBe(false)
    })
  })

  describe('savePatientSchema', () => {
    it('should accept valid patient', () => {
      expect(savePatientSchema.safeParse({
        action: 'save-patient',
        name: 'Jane Doe',
        phone: '9876543210',
      }).success).toBe(true)
    })

    it('should accept with all optional fields', () => {
      expect(savePatientSchema.safeParse({
        action: 'save-patient',
        name: 'Jane Doe',
        phone: '9876543210',
        age: 30,
        email: 'jane@test.com',
        gender: 'Female',
        address: '123 Main St',
      }).success).toBe(true)
    })

    it('should accept empty string for email', () => {
      expect(savePatientSchema.safeParse({
        action: 'save-patient',
        name: 'Jane',
        phone: '9876543210',
        email: '',
      }).success).toBe(true)
    })

    it('should reject invalid email', () => {
      expect(savePatientSchema.safeParse({
        action: 'save-patient',
        name: 'Jane',
        phone: '9876543210',
        email: 'not-email',
      }).success).toBe(false)
    })

    it('should reject age > 150', () => {
      expect(savePatientSchema.safeParse({
        action: 'save-patient',
        name: 'Jane',
        phone: '9876543210',
        age: 200,
      }).success).toBe(false)
    })

    it('should reject address > 500 chars', () => {
      expect(savePatientSchema.safeParse({
        action: 'save-patient',
        name: 'Jane',
        phone: '9876543210',
        address: 'x'.repeat(501),
      }).success).toBe(false)
    })
  })

  describe('listSpecialtiesSchema', () => {
    it('should accept valid action', () => {
      expect(listSpecialtiesSchema.safeParse({ action: 'list-specialties' }).success).toBe(true)
    })

    it('should reject wrong action', () => {
      expect(listSpecialtiesSchema.safeParse({ action: 'list-doctors' }).success).toBe(false)
    })
  })

  describe('bookingActionSchema (discriminated union)', () => {
    it('should accept book-appointment action', () => {
      expect(bookingActionSchema.safeParse({
        action: 'book-appointment',
        doctor_id: 'doc-1',
        doctor_name: 'Dr. Smith',
        patient_name: 'John',
        patient_phone: '9876543210',
        date: '2026-04-01',
        time: '10:30',
      }).success).toBe(true)
    })

    it('should accept cancel-appointment action', () => {
      expect(bookingActionSchema.safeParse({
        action: 'cancel-appointment',
        booking_id: 'BK-001',
      }).success).toBe(true)
    })

    it('should accept check-availability action', () => {
      expect(bookingActionSchema.safeParse({
        action: 'check-availability',
      }).success).toBe(true)
    })

    it('should accept patient-lookup action', () => {
      expect(bookingActionSchema.safeParse({
        action: 'patient-lookup',
        phone: '9876543210',
      }).success).toBe(true)
    })

    it('should accept save-patient action', () => {
      expect(bookingActionSchema.safeParse({
        action: 'save-patient',
        name: 'Jane',
        phone: '9876543210',
      }).success).toBe(true)
    })

    it('should accept list-specialties action', () => {
      expect(bookingActionSchema.safeParse({
        action: 'list-specialties',
      }).success).toBe(true)
    })

    it('should reject unknown action', () => {
      expect(bookingActionSchema.safeParse({
        action: 'delete-everything',
      }).success).toBe(false)
    })

    it('should reject missing action', () => {
      expect(bookingActionSchema.safeParse({}).success).toBe(false)
    })
  })
})

// ─── WhatsApp Route Schemas ─────────────────────────────────────────────────

describe('WhatsApp Route Schemas', () => {
  describe('waActionSchema', () => {
    it('should accept valid action with token', () => {
      expect(waActionSchema.safeParse({ token: 'abc123', action: 'lookup_patient' }).success).toBe(true)
    })

    it('should accept all valid actions', () => {
      const validActions = [
        'lookup_patient', 'save_patient', 'list_specialties',
        'check_availability', 'book_appointment', 'list_appointments',
        'cancel_appointment', 'reschedule_appointment', 'list_prescriptions',
      ]
      for (const action of validActions) {
        expect(waActionSchema.safeParse({ token: 'test-token', action }).success).toBe(true)
      }
    })

    it('should reject missing token', () => {
      expect(waActionSchema.safeParse({ action: 'lookup_patient' }).success).toBe(false)
    })

    it('should reject empty token', () => {
      expect(waActionSchema.safeParse({ token: '', action: 'lookup_patient' }).success).toBe(false)
    })

    it('should reject invalid action', () => {
      expect(waActionSchema.safeParse({ token: 'abc', action: 'hack_database' }).success).toBe(false)
    })

    it('should reject missing action', () => {
      expect(waActionSchema.safeParse({ token: 'abc123' }).success).toBe(false)
    })

    it('should allow extra fields (passthrough)', () => {
      const result = waActionSchema.safeParse({
        token: 'abc',
        action: 'book_appointment',
        doctor_id: 'doc-1',
        patient_name: 'John',
      })
      expect(result.success).toBe(true)
    })
  })
})

// ─── OTP Schemas ────────────────────────────────────────────────────────────

describe('OTP Schemas', () => {
  describe('sendOtpSchema', () => {
    it('should accept valid phone', () => {
      expect(sendOtpSchema.safeParse({ phone: '9876543210' }).success).toBe(true)
    })

    it('should accept phone with any format (just min 1)', () => {
      expect(sendOtpSchema.safeParse({ phone: '+91 98765 43210' }).success).toBe(true)
    })

    it('should reject empty phone', () => {
      expect(sendOtpSchema.safeParse({ phone: '' }).success).toBe(false)
    })

    it('should reject missing phone field', () => {
      expect(sendOtpSchema.safeParse({}).success).toBe(false)
    })
  })
})

// ─── Payment Schemas ────────────────────────────────────────────────────────

describe('Payment Schemas', () => {
  describe('createOrderSchema (legacy)', () => {
    it('should accept valid order', () => {
      expect(createOrderSchema.safeParse({
        booking_id: 'BK-001',
        amount: 500,
        patient_name: 'John',
        patient_phone: '9876543210',
      }).success).toBe(true)
    })

    it('should reject negative amount', () => {
      expect(createOrderSchema.safeParse({
        booking_id: 'BK-001',
        amount: -100,
        patient_name: 'John',
        patient_phone: '9876543210',
      }).success).toBe(false)
    })

    it('should reject zero amount', () => {
      expect(createOrderSchema.safeParse({
        booking_id: 'BK-001',
        amount: 0,
        patient_name: 'John',
        patient_phone: '9876543210',
      }).success).toBe(false)
    })
  })

  describe('createOrderBodySchema', () => {
    it('should accept valid booking_id', () => {
      expect(createOrderBodySchema.safeParse({ booking_id: 'BK-001' }).success).toBe(true)
    })

    it('should reject missing booking_id', () => {
      expect(createOrderBodySchema.safeParse({}).success).toBe(false)
    })

    it('should reject empty booking_id', () => {
      expect(createOrderBodySchema.safeParse({ booking_id: '' }).success).toBe(false)
    })

    it('should reject booking_id > 60 chars', () => {
      expect(createOrderBodySchema.safeParse({ booking_id: 'x'.repeat(61) }).success).toBe(false)
    })
  })

  describe('paymentStatusQuerySchema', () => {
    it('should accept valid booking_id', () => {
      expect(paymentStatusQuerySchema.safeParse({ booking_id: 'BK-001' }).success).toBe(true)
    })

    it('should reject missing booking_id', () => {
      expect(paymentStatusQuerySchema.safeParse({}).success).toBe(false)
    })

    it('should trim booking_id whitespace', () => {
      const result = paymentStatusQuerySchema.safeParse({ booking_id: '  BK-001  ' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.booking_id).toBe('BK-001')
      }
    })
  })

  describe('verifyCheckoutBodySchema', () => {
    const validCheckout = {
      razorpay_payment_id: 'pay_abc123',
      razorpay_order_id: 'order_abc123',
      razorpay_signature: 'sig_abc123',
      booking_id: 'BK-001',
    }

    it('should accept valid checkout data', () => {
      expect(verifyCheckoutBodySchema.safeParse(validCheckout).success).toBe(true)
    })

    it('should reject missing razorpay_payment_id', () => {
      const { razorpay_payment_id, ...rest } = validCheckout
      expect(verifyCheckoutBodySchema.safeParse(rest).success).toBe(false)
    })

    it('should reject missing razorpay_order_id', () => {
      const { razorpay_order_id, ...rest } = validCheckout
      expect(verifyCheckoutBodySchema.safeParse(rest).success).toBe(false)
    })

    it('should reject missing razorpay_signature', () => {
      const { razorpay_signature, ...rest } = validCheckout
      expect(verifyCheckoutBodySchema.safeParse(rest).success).toBe(false)
    })

    it('should reject empty payment_id', () => {
      expect(verifyCheckoutBodySchema.safeParse({
        ...validCheckout,
        razorpay_payment_id: '',
      }).success).toBe(false)
    })

    it('should reject payment_id > 100 chars', () => {
      expect(verifyCheckoutBodySchema.safeParse({
        ...validCheckout,
        razorpay_payment_id: 'x'.repeat(101),
      }).success).toBe(false)
    })

    it('should reject signature > 200 chars', () => {
      expect(verifyCheckoutBodySchema.safeParse({
        ...validCheckout,
        razorpay_signature: 'x'.repeat(201),
      }).success).toBe(false)
    })
  })

  describe('sendEmailsBodySchema', () => {
    it('should accept empty object (all fields optional)', () => {
      expect(sendEmailsBodySchema.safeParse({}).success).toBe(true)
    })

    it('should accept full email body', () => {
      expect(sendEmailsBodySchema.safeParse({
        type: 'appointment',
        patient_phone: '9876543210',
        patient_name: 'John',
        doctor_name: 'Dr. Smith',
        specialty: 'Cardiology',
        date: '2026-04-01',
        time: '10:30',
        booking_id: 'BK-001',
        hospital_name: 'City Hospital',
        payment_id: 'pay_123',
        amount: 500,
      }).success).toBe(true)
    })

    it('should accept amount as string', () => {
      expect(sendEmailsBodySchema.safeParse({ amount: '500' }).success).toBe(true)
    })

    it('should accept amount as number', () => {
      expect(sendEmailsBodySchema.safeParse({ amount: 500 }).success).toBe(true)
    })

    it('should accept reschedule_count as string or number', () => {
      expect(sendEmailsBodySchema.safeParse({ reschedule_count: '2' }).success).toBe(true)
      expect(sendEmailsBodySchema.safeParse({ reschedule_count: 2 }).success).toBe(true)
    })

    it('should reject invalid type', () => {
      expect(sendEmailsBodySchema.safeParse({ type: 'invalid' }).success).toBe(false)
    })

    it('should accept all valid types', () => {
      for (const type of ['appointment', 'cancellation', 'reschedule']) {
        expect(sendEmailsBodySchema.safeParse({ type }).success).toBe(true)
      }
    })

    it('should reject email_html > 50000 chars', () => {
      expect(sendEmailsBodySchema.safeParse({ email_html: 'x'.repeat(50001) }).success).toBe(false)
    })

    it('should reject email_subject > 200 chars', () => {
      expect(sendEmailsBodySchema.safeParse({ email_subject: 'x'.repeat(201) }).success).toBe(false)
    })
  })
})

// ─── Auth Schemas ───────────────────────────────────────────────────────────

describe('Auth Schemas', () => {
  describe('createPasswordBodySchema', () => {
    const validPassword = {
      email: 'test@example.com',
      password: 'Str0ng!Pass',
    }

    it('should accept valid email + strong password', () => {
      expect(createPasswordBodySchema.safeParse(validPassword).success).toBe(true)
    })

    it('should lowercase email', () => {
      const result = createPasswordBodySchema.safeParse({
        email: 'TEST@EXAMPLE.COM',
        password: 'Str0ng!Pass',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.email).toBe('test@example.com')
      }
    })

    it('should reject password without uppercase', () => {
      expect(createPasswordBodySchema.safeParse({
        email: 'test@example.com',
        password: 'str0ng!pass',
      }).success).toBe(false)
    })

    it('should reject password without lowercase', () => {
      expect(createPasswordBodySchema.safeParse({
        email: 'test@example.com',
        password: 'STR0NG!PASS',
      }).success).toBe(false)
    })

    it('should reject password without number', () => {
      expect(createPasswordBodySchema.safeParse({
        email: 'test@example.com',
        password: 'Strong!Pass',
      }).success).toBe(false)
    })

    it('should reject password without special character', () => {
      expect(createPasswordBodySchema.safeParse({
        email: 'test@example.com',
        password: 'Str0ngPass1',
      }).success).toBe(false)
    })

    it('should reject password < 10 chars', () => {
      expect(createPasswordBodySchema.safeParse({
        email: 'test@example.com',
        password: 'St0!ng',
      }).success).toBe(false)
    })

    it('should reject password > 128 chars', () => {
      expect(createPasswordBodySchema.safeParse({
        email: 'test@example.com',
        password: 'A1!' + 'a'.repeat(126),
      }).success).toBe(false)
    })

    it('should reject invalid email', () => {
      expect(createPasswordBodySchema.safeParse({
        email: 'bad-email',
        password: 'Str0ng!Pass',
      }).success).toBe(false)
    })
  })

  describe('forgotPasswordBodySchema', () => {
    it('should accept valid email', () => {
      expect(forgotPasswordBodySchema.safeParse({ email: 'test@example.com' }).success).toBe(true)
    })

    it('should lowercase email', () => {
      const result = forgotPasswordBodySchema.safeParse({ email: 'TEST@EXAMPLE.COM' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.email).toBe('test@example.com')
      }
    })

    it('should reject missing email', () => {
      expect(forgotPasswordBodySchema.safeParse({}).success).toBe(false)
    })

    it('should reject invalid email', () => {
      expect(forgotPasswordBodySchema.safeParse({ email: 'not-email' }).success).toBe(false)
    })
  })
})

// ─── Doctor Leave Schemas ───────────────────────────────────────────────────

describe('Doctor Leave Schemas', () => {
  describe('doctorLeaveBodySchema', () => {
    it('should accept valid leave request', () => {
      expect(doctorLeaveBodySchema.safeParse({
        doctor_id: 'doc-1',
        date: '2026-04-01',
        type: 'leave',
      }).success).toBe(true)
    })

    it('should accept custom_hours with start_time and end_time', () => {
      expect(doctorLeaveBodySchema.safeParse({
        doctor_id: 'doc-1',
        date: '2026-04-01',
        type: 'custom_hours',
        start_time: '09:00',
        end_time: '13:00',
      }).success).toBe(true)
    })

    it('should reject custom_hours without start_time', () => {
      expect(doctorLeaveBodySchema.safeParse({
        doctor_id: 'doc-1',
        date: '2026-04-01',
        type: 'custom_hours',
        end_time: '13:00',
      }).success).toBe(false)
    })

    it('should reject custom_hours without end_time', () => {
      expect(doctorLeaveBodySchema.safeParse({
        doctor_id: 'doc-1',
        date: '2026-04-01',
        type: 'custom_hours',
        start_time: '09:00',
      }).success).toBe(false)
    })

    it('should strip HTML from reason', () => {
      const result = doctorLeaveBodySchema.safeParse({
        doctor_id: 'doc-1',
        date: '2026-04-01',
        type: 'leave',
        reason: 'Sick <script>alert("xss")</script> leave',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.reason).toBe('Sick alert("xss") leave')
      }
    })

    it('should reject invalid type', () => {
      expect(doctorLeaveBodySchema.safeParse({
        doctor_id: 'doc-1',
        date: '2026-04-01',
        type: 'vacation',
      }).success).toBe(false)
    })

    it('should reject missing doctor_id', () => {
      expect(doctorLeaveBodySchema.safeParse({
        date: '2026-04-01',
        type: 'leave',
      }).success).toBe(false)
    })

    it('should reject invalid date format', () => {
      expect(doctorLeaveBodySchema.safeParse({
        doctor_id: 'doc-1',
        date: '04/01/2026',
        type: 'leave',
      }).success).toBe(false)
    })
  })
})

// ─── Notifications Schemas ──────────────────────────────────────────────────

describe('Notifications Schemas', () => {
  describe('postConsultationBodySchema', () => {
    it('should accept minimal valid body', () => {
      expect(postConsultationBodySchema.safeParse({
        patient_phone: '9876543210',
        tenant_id: 'tenant-1',
      }).success).toBe(true)
    })

    it('should accept full body with items and lab_tests', () => {
      expect(postConsultationBodySchema.safeParse({
        patient_phone: '9876543210',
        tenant_id: 'tenant-1',
        prescription_id: 'rx-001',
        booking_id: 'bk-001',
        patient_name: 'John',
        doctor_name: 'Dr. Smith',
        doctor_id: 'doc-1',
        specialty: 'General',
        diagnosis: 'Common cold',
        items: [
          { medicine_name: 'Paracetamol', dosage: '500mg' },
          { name: 'Amoxicillin', dosage: '250mg' },
        ],
        lab_tests: [
          'CBC',
          { test_name: 'Blood Sugar' },
          { name: 'Thyroid Panel' },
        ],
        follow_up_date: '2026-04-15',
      }).success).toBe(true)
    })

    it('should strip HTML from patient_name', () => {
      const result = postConsultationBodySchema.safeParse({
        patient_phone: '9876543210',
        tenant_id: 'tenant-1',
        patient_name: '<b>John</b> <script>xss</script>',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.patient_name).toBe('John xss')
      }
    })

    it('should strip HTML from diagnosis', () => {
      const result = postConsultationBodySchema.safeParse({
        patient_phone: '9876543210',
        tenant_id: 'tenant-1',
        diagnosis: 'Test <img src=x onerror=alert(1)> diagnosis',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.diagnosis).toBe('Test  diagnosis')
      }
    })

    it('should reject items array > 50', () => {
      const items = Array.from({ length: 51 }, (_, i) => ({ name: `Med ${i}` }))
      expect(postConsultationBodySchema.safeParse({
        patient_phone: '9876543210',
        tenant_id: 'tenant-1',
        items,
      }).success).toBe(false)
    })

    it('should reject lab_tests array > 50', () => {
      const lab_tests = Array.from({ length: 51 }, (_, i) => `Test ${i}`)
      expect(postConsultationBodySchema.safeParse({
        patient_phone: '9876543210',
        tenant_id: 'tenant-1',
        lab_tests,
      }).success).toBe(false)
    })

    it('should reject missing patient_phone', () => {
      expect(postConsultationBodySchema.safeParse({
        tenant_id: 'tenant-1',
      }).success).toBe(false)
    })

    it('should reject missing tenant_id', () => {
      expect(postConsultationBodySchema.safeParse({
        patient_phone: '9876543210',
      }).success).toBe(false)
    })
  })
})

// ─── Patient Booking Schemas ────────────────────────────────────────────────

describe('Patient Booking Schemas', () => {
  describe('patientBookingActionSchema', () => {
    it('should accept list-specialties', () => {
      expect(patientBookingActionSchema.safeParse({
        action: 'list-specialties',
      }).success).toBe(true)
    })

    it('should accept list-specialties with tenant_id', () => {
      expect(patientBookingActionSchema.safeParse({
        action: 'list-specialties',
        tenant_id: 'tenant-1',
      }).success).toBe(true)
    })

    it('should accept check-availability', () => {
      expect(patientBookingActionSchema.safeParse({
        action: 'check-availability',
        doctor_id: 'doc-1',
        specialty: 'Cardiology',
      }).success).toBe(true)
    })

    it('should accept book-appointment', () => {
      expect(patientBookingActionSchema.safeParse({
        action: 'book-appointment',
        doctor_id: 'doc-1',
        doctor_name: 'Dr. Smith',
        date: '2026-04-01',
        time: '10:30',
      }).success).toBe(true)
    })

    it('should reject book-appointment without doctor_id', () => {
      expect(patientBookingActionSchema.safeParse({
        action: 'book-appointment',
        doctor_name: 'Dr. Smith',
        date: '2026-04-01',
        time: '10:30',
      }).success).toBe(false)
    })

    it('should reject unknown action', () => {
      expect(patientBookingActionSchema.safeParse({
        action: 'delete-all',
      }).success).toBe(false)
    })
  })

  describe('patientAppointmentBodySchema', () => {
    it('should accept valid cancel action', () => {
      expect(patientAppointmentBodySchema.safeParse({
        action: 'cancel',
        booking_id: 'BK-001',
      }).success).toBe(true)
    })

    it('should reject wrong action', () => {
      expect(patientAppointmentBodySchema.safeParse({
        action: 'reschedule',
        booking_id: 'BK-001',
      }).success).toBe(false)
    })

    it('should reject missing booking_id', () => {
      expect(patientAppointmentBodySchema.safeParse({
        action: 'cancel',
      }).success).toBe(false)
    })

    it('should reject empty booking_id', () => {
      expect(patientAppointmentBodySchema.safeParse({
        action: 'cancel',
        booking_id: '',
      }).success).toBe(false)
    })
  })
})

// ─── WhatsApp Agent Reply Schemas ───────────────────────────────────────────

describe('WhatsApp Agent Reply Schemas', () => {
  describe('agentReplyBodySchema', () => {
    it('should accept valid reply with message', () => {
      const result = agentReplyBodySchema.safeParse({
        chat_id: 'chat-123',
        message: 'Hello patient',
      })
      expect(result.success).toBe(true)
    })

    it('should accept reply with close action', () => {
      expect(agentReplyBodySchema.safeParse({
        chat_id: 'chat-123',
        action: 'close',
      }).success).toBe(true)
    })

    it('should strip HTML from message', () => {
      const result = agentReplyBodySchema.safeParse({
        chat_id: 'chat-123',
        message: 'Hello <script>alert("xss")</script> world',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.message).toBe('Hello alert("xss") world')
      }
    })

    it('should reject empty chat_id', () => {
      expect(agentReplyBodySchema.safeParse({
        chat_id: '',
        message: 'Hello',
      }).success).toBe(false)
    })

    it('should reject missing chat_id', () => {
      expect(agentReplyBodySchema.safeParse({
        message: 'Hello',
      }).success).toBe(false)
    })

    it('should reject chat_id > 100 chars', () => {
      expect(agentReplyBodySchema.safeParse({
        chat_id: 'x'.repeat(101),
        message: 'Hello',
      }).success).toBe(false)
    })

    it('should reject message > 4096 chars', () => {
      expect(agentReplyBodySchema.safeParse({
        chat_id: 'chat-123',
        message: 'x'.repeat(4097),
      }).success).toBe(false)
    })

    it('should reject invalid action', () => {
      expect(agentReplyBodySchema.safeParse({
        chat_id: 'chat-123',
        action: 'delete',
      }).success).toBe(false)
    })
  })
})

// ─── Telemedicine Schemas ───────────────────────────────────────────────────

describe('Telemedicine Schemas', () => {
  describe('telemedicineSendLinkBodySchema', () => {
    const validBody = {
      patientPhone: '9876543210',
      roomName: 'room-123',
      doctorName: 'Dr. Smith',
      patientName: 'John Doe',
    }

    it('should accept valid body', () => {
      expect(telemedicineSendLinkBodySchema.safeParse(validBody).success).toBe(true)
    })

    it('should accept with optional tenantId', () => {
      expect(telemedicineSendLinkBodySchema.safeParse({
        ...validBody,
        tenantId: 'tenant-1',
      }).success).toBe(true)
    })

    it('should reject missing patientPhone', () => {
      const { patientPhone, ...rest } = validBody
      expect(telemedicineSendLinkBodySchema.safeParse(rest).success).toBe(false)
    })

    it('should reject missing roomName', () => {
      const { roomName, ...rest } = validBody
      expect(telemedicineSendLinkBodySchema.safeParse(rest).success).toBe(false)
    })

    it('should reject missing doctorName', () => {
      const { doctorName, ...rest } = validBody
      expect(telemedicineSendLinkBodySchema.safeParse(rest).success).toBe(false)
    })

    it('should reject missing patientName', () => {
      const { patientName, ...rest } = validBody
      expect(telemedicineSendLinkBodySchema.safeParse(rest).success).toBe(false)
    })

    it('should reject roomName > 100 chars', () => {
      expect(telemedicineSendLinkBodySchema.safeParse({
        ...validBody,
        roomName: 'x'.repeat(101),
      }).success).toBe(false)
    })
  })
})

// ─── Queue Notify Schemas ───────────────────────────────────────────────────

describe('Queue Notify Schemas', () => {
  describe('queueNotifyBodySchema', () => {
    it('should accept valid body with number queue_number', () => {
      expect(queueNotifyBodySchema.safeParse({
        phone: '9876543210',
        queue_number: 5,
      }).success).toBe(true)
    })

    it('should accept queue_number as string', () => {
      expect(queueNotifyBodySchema.safeParse({
        phone: '9876543210',
        queue_number: 'A-05',
      }).success).toBe(true)
    })

    it('should accept full body with optional fields', () => {
      expect(queueNotifyBodySchema.safeParse({
        phone: '9876543210',
        queue_number: 5,
        patient_name: 'John',
        doctor_name: 'Dr. Smith',
        hospital_name: 'City Hospital',
        estimated_wait: 30,
        waiting_ahead: 3,
        queue_url: 'https://hospital.com/queue/123',
      }).success).toBe(true)
    })

    it('should reject missing phone', () => {
      expect(queueNotifyBodySchema.safeParse({
        queue_number: 5,
      }).success).toBe(false)
    })

    it('should reject empty phone', () => {
      expect(queueNotifyBodySchema.safeParse({
        phone: '',
        queue_number: 5,
      }).success).toBe(false)
    })

    it('should reject negative estimated_wait', () => {
      expect(queueNotifyBodySchema.safeParse({
        phone: '9876543210',
        queue_number: 5,
        estimated_wait: -10,
      }).success).toBe(false)
    })

    it('should reject negative waiting_ahead', () => {
      expect(queueNotifyBodySchema.safeParse({
        phone: '9876543210',
        queue_number: 5,
        waiting_ahead: -1,
      }).success).toBe(false)
    })

    it('should reject queue_url > 500 chars', () => {
      expect(queueNotifyBodySchema.safeParse({
        phone: '9876543210',
        queue_number: 5,
        queue_url: 'x'.repeat(501),
      }).success).toBe(false)
    })

    it('should reject empty string queue_number', () => {
      expect(queueNotifyBodySchema.safeParse({
        phone: '9876543210',
        queue_number: '',
      }).success).toBe(false)
    })
  })
})

// ─── Push Subscribe Schemas ─────────────────────────────────────────────────

describe('Push Subscribe Schemas', () => {
  describe('pushSubscribeBodySchema', () => {
    const validSubscription = {
      subscription: {
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
        keys: {
          p256dh: 'BLx5O...',
          auth: 'aWpG...',
        },
      },
    }

    it('should accept valid subscription', () => {
      expect(pushSubscribeBodySchema.safeParse(validSubscription).success).toBe(true)
    })

    it('should reject invalid endpoint URL', () => {
      expect(pushSubscribeBodySchema.safeParse({
        subscription: {
          endpoint: 'not-a-url',
          keys: { p256dh: 'abc', auth: 'def' },
        },
      }).success).toBe(false)
    })

    it('should reject missing keys', () => {
      expect(pushSubscribeBodySchema.safeParse({
        subscription: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
        },
      }).success).toBe(false)
    })

    it('should reject empty p256dh', () => {
      expect(pushSubscribeBodySchema.safeParse({
        subscription: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
          keys: { p256dh: '', auth: 'abc' },
        },
      }).success).toBe(false)
    })

    it('should reject empty auth', () => {
      expect(pushSubscribeBodySchema.safeParse({
        subscription: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
          keys: { p256dh: 'abc', auth: '' },
        },
      }).success).toBe(false)
    })

    it('should reject missing subscription object', () => {
      expect(pushSubscribeBodySchema.safeParse({}).success).toBe(false)
    })

    it('should reject endpoint > 2048 chars', () => {
      expect(pushSubscribeBodySchema.safeParse({
        subscription: {
          endpoint: 'https://example.com/' + 'x'.repeat(2040),
          keys: { p256dh: 'abc', auth: 'def' },
        },
      }).success).toBe(false)
    })
  })
})

// ─── ABDM Schemas ───────────────────────────────────────────────────────────

describe('ABDM Schemas', () => {
  describe('abdmActionSchema (discriminated union)', () => {
    it('should accept request-otp', () => {
      expect(abdmActionSchema.safeParse({
        action: 'request-otp',
        abhaNumber: '12-3456-7890-1234',
      }).success).toBe(true)
    })

    it('should accept request-otp with authMethod', () => {
      expect(abdmActionSchema.safeParse({
        action: 'request-otp',
        authMethod: 'MOBILE_OTP',
      }).success).toBe(true)
    })

    it('should reject invalid authMethod', () => {
      expect(abdmActionSchema.safeParse({
        action: 'request-otp',
        authMethod: 'EMAIL_OTP',
      }).success).toBe(false)
    })

    it('should accept verify-otp', () => {
      expect(abdmActionSchema.safeParse({
        action: 'verify-otp',
        txnId: 'txn-123',
        otp: '123456',
      }).success).toBe(true)
    })

    it('should reject verify-otp without txnId', () => {
      expect(abdmActionSchema.safeParse({
        action: 'verify-otp',
        otp: '123456',
      }).success).toBe(false)
    })

    it('should reject verify-otp without otp', () => {
      expect(abdmActionSchema.safeParse({
        action: 'verify-otp',
        txnId: 'txn-123',
      }).success).toBe(false)
    })

    it('should reject otp shorter than 4 chars', () => {
      expect(abdmActionSchema.safeParse({
        action: 'verify-otp',
        txnId: 'txn-123',
        otp: '123',
      }).success).toBe(false)
    })

    it('should reject otp longer than 8 chars', () => {
      expect(abdmActionSchema.safeParse({
        action: 'verify-otp',
        txnId: 'txn-123',
        otp: '123456789',
      }).success).toBe(false)
    })

    it('should accept link-abha', () => {
      expect(abdmActionSchema.safeParse({
        action: 'link-abha',
        patientPhone: '9876543210',
        abhaNumber: '12-3456-7890',
      }).success).toBe(true)
    })

    it('should reject link-abha without patientPhone', () => {
      expect(abdmActionSchema.safeParse({
        action: 'link-abha',
        abhaNumber: '12-3456-7890',
      }).success).toBe(false)
    })

    it('should accept unlink-abha', () => {
      expect(abdmActionSchema.safeParse({
        action: 'unlink-abha',
        patientPhone: '9876543210',
      }).success).toBe(true)
    })

    it('should accept create-consent', () => {
      expect(abdmActionSchema.safeParse({
        action: 'create-consent',
        patientPhone: '9876543210',
        purpose: 'CareManagement',
        hiTypes: ['OPConsultation', 'Prescription'],
      }).success).toBe(true)
    })

    it('should reject create-consent hiTypes > 10', () => {
      const hiTypes = Array.from({ length: 11 }, (_, i) => `Type${i}`)
      expect(abdmActionSchema.safeParse({
        action: 'create-consent',
        hiTypes,
      }).success).toBe(false)
    })

    it('should accept update-consent', () => {
      expect(abdmActionSchema.safeParse({
        action: 'update-consent',
        consentId: 'consent-123',
        status: 'GRANTED',
      }).success).toBe(true)
    })

    it('should reject update-consent with invalid status', () => {
      expect(abdmActionSchema.safeParse({
        action: 'update-consent',
        consentId: 'consent-123',
        status: 'PENDING',
      }).success).toBe(false)
    })

    it('should accept all valid consent statuses', () => {
      for (const status of ['GRANTED', 'DENIED', 'REVOKED']) {
        expect(abdmActionSchema.safeParse({
          action: 'update-consent',
          consentId: 'consent-123',
          status,
        }).success).toBe(true)
      }
    })

    it('should accept list-consents', () => {
      expect(abdmActionSchema.safeParse({
        action: 'list-consents',
      }).success).toBe(true)
    })

    it('should accept generate-health-record', () => {
      expect(abdmActionSchema.safeParse({
        action: 'generate-health-record',
        recordType: 'OPConsultation',
        sourceId: 'src-123',
        patientPhone: '9876543210',
      }).success).toBe(true)
    })

    it('should reject generate-health-record with invalid recordType', () => {
      expect(abdmActionSchema.safeParse({
        action: 'generate-health-record',
        recordType: 'LabReport',
        sourceId: 'src-123',
        patientPhone: '9876543210',
      }).success).toBe(false)
    })

    it('should accept all valid recordTypes', () => {
      for (const recordType of ['OPConsultation', 'Prescription', 'DischargeSummary', 'DiagnosticReport']) {
        expect(abdmActionSchema.safeParse({
          action: 'generate-health-record',
          recordType,
          sourceId: 'src-123',
          patientPhone: '9876543210',
        }).success).toBe(true)
      }
    })

    it('should accept list-health-records', () => {
      expect(abdmActionSchema.safeParse({
        action: 'list-health-records',
      }).success).toBe(true)
    })

    it('should accept get-consent-artifact', () => {
      expect(abdmActionSchema.safeParse({
        action: 'get-consent-artifact',
        consentId: 'consent-123',
      }).success).toBe(true)
    })

    it('should reject get-consent-artifact without consentId', () => {
      expect(abdmActionSchema.safeParse({
        action: 'get-consent-artifact',
      }).success).toBe(false)
    })

    it('should reject unknown action', () => {
      expect(abdmActionSchema.safeParse({
        action: 'hack-system',
      }).success).toBe(false)
    })
  })
})

// ─── Platform Schemas ───────────────────────────────────────────────────────

describe('Platform Schemas', () => {
  describe('platformScopeSchema', () => {
    it('should accept all valid scopes', () => {
      const validScopes = ['dashboard', 'clients', 'client', 'health-ping', 'n8n-health', 'whatsapp-routing']
      for (const scope of validScopes) {
        expect(platformScopeSchema.safeParse(scope).success).toBe(true)
      }
    })

    it('should reject invalid scope', () => {
      expect(platformScopeSchema.safeParse('admin-panel').success).toBe(false)
    })

    it('should reject empty string', () => {
      expect(platformScopeSchema.safeParse('').success).toBe(false)
    })
  })

  describe('platformPostBodySchema', () => {
    it('should accept valid action', () => {
      expect(platformPostBodySchema.safeParse({
        action: 'createClient',
        name: 'Test Hospital',
      }).success).toBe(true)
    })

    it('should accept all valid actions', () => {
      const actions = ['createClient', 'createBranch', 'updateBranch', 'saveWhatsAppRoute', 'deleteWhatsAppRoute']
      for (const action of actions) {
        expect(platformPostBodySchema.safeParse({ action }).success).toBe(true)
      }
    })

    it('should reject invalid action', () => {
      expect(platformPostBodySchema.safeParse({ action: 'dropDatabase' }).success).toBe(false)
    })

    it('should allow extra fields (passthrough)', () => {
      const result = platformPostBodySchema.safeParse({
        action: 'createClient',
        name: 'Test',
        slug: 'test',
        extra_field: 'value',
      })
      expect(result.success).toBe(true)
    })
  })
})

// ─── Helper Function ────────────────────────────────────────────────────────

describe('validateBody helper', () => {
  it('should return success with data for valid input', () => {
    const result = validateBody(bookingIdSchema, 'BK-001')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe('BK-001')
    }
  })

  it('should return error with details for invalid input', () => {
    const result = validateBody(bookingIdSchema, '')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('Validation failed')
      expect(result.details).toBeDefined()
      expect(result.details.length).toBeGreaterThan(0)
    }
  })

  it('should work with complex schemas', () => {
    const result = validateBody(createPasswordBodySchema, {
      email: 'test@example.com',
      password: 'Str0ng!Pass',
    })
    expect(result.success).toBe(true)
  })

  it('should return detailed error issues', () => {
    const result = validateBody(createPasswordBodySchema, {
      email: 'bad',
      password: 'weak',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.details.length).toBeGreaterThanOrEqual(2)
    }
  })
})

// ─── XSS Prevention Tests ──────────────────────────────────────────────────

describe('XSS Prevention', () => {
  it('should strip script tags from agent reply message', () => {
    const result = agentReplyBodySchema.safeParse({
      chat_id: 'chat-1',
      message: '<script>document.cookie</script>Your appointment is confirmed',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.message).not.toContain('<script>')
      expect(result.data.message).toContain('Your appointment is confirmed')
    }
  })

  it('should strip img onerror from safe text', () => {
    const schema = safeTextSchema(500)
    const result = schema.safeParse('<img src=x onerror=alert(1)>Hello')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toContain('<img')
      expect(result.data).toContain('Hello')
    }
  })

  it('should strip event handlers from doctor leave reason', () => {
    const result = doctorLeaveBodySchema.safeParse({
      doctor_id: 'doc-1',
      date: '2026-04-01',
      type: 'leave',
      reason: '<div onmouseover="alert(1)">Sick</div>',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.reason).toBe('Sick')
    }
  })

  it('should strip anchor tags with javascript: protocol', () => {
    const schema = safeTextSchema(500)
    const result = schema.safeParse('<a href="javascript:alert(1)">Click me</a>')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe('Click me')
      expect(result.data).not.toContain('javascript:')
    }
  })
})
