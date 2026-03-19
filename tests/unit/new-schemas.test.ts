import { describe, it, expect } from 'vitest'
import {
  ipdActionSchema,
  billingActionSchema,
  labActionSchema,
  pharmacyActionSchema,
  analyticsQuerySchema,
} from '@/lib/validations/api-schemas'

// ─── IPD Action Schema ─────────────────────────────────────────────────────

describe('ipdActionSchema', () => {
  describe('admit', () => {
    it('should validate a valid admission', () => {
      const result = ipdActionSchema.safeParse({
        action: 'admit',
        patient_phone: '9876543210',
        patient_name: 'John Doe',
        ward: 'General',
        bed_number: 'G-01',
      })
      expect(result.success).toBe(true)
    })

    it('should accept optional fields', () => {
      const result = ipdActionSchema.safeParse({
        action: 'admit',
        patient_phone: '9876543210',
        patient_name: 'John Doe',
        ward: 'ICU',
        bed_number: 'ICU-3',
        doctor_id: 'DOC001',
        doctor_name: 'Dr. Smith',
        diagnosis: 'Pneumonia',
        expected_discharge: '2026-03-25',
        from_appointment: 'BK_123',
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing required fields', () => {
      const result = ipdActionSchema.safeParse({
        action: 'admit',
        patient_phone: '9876543210',
        // missing patient_name, ward, bed_number
      })
      expect(result.success).toBe(false)
    })

    it('should strip HTML from patient_name', () => {
      const result = ipdActionSchema.safeParse({
        action: 'admit',
        patient_phone: '9876543210',
        patient_name: '<script>alert("xss")</script>John',
        ward: 'General',
        bed_number: 'G-01',
      })
      expect(result.success).toBe(true)
      if (result.success && result.data.action === 'admit') {
        expect(result.data.patient_name).toBe('alert("xss")John')
      }
    })
  })

  describe('transfer', () => {
    it('should validate a valid transfer', () => {
      const result = ipdActionSchema.safeParse({
        action: 'transfer',
        admission_id: 'ADM_123',
        to_ward: 'ICU',
        to_bed: 'ICU-5',
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing admission_id', () => {
      const result = ipdActionSchema.safeParse({
        action: 'transfer',
        to_ward: 'ICU',
        to_bed: 'ICU-5',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('discharge', () => {
    it('should validate a valid discharge', () => {
      const result = ipdActionSchema.safeParse({
        action: 'discharge',
        admission_id: 'ADM_123',
        final_diagnosis: 'Recovered from pneumonia',
        treatment_given: 'Antibiotics course completed',
      })
      expect(result.success).toBe(true)
    })

    it('should accept medications_on_discharge', () => {
      const result = ipdActionSchema.safeParse({
        action: 'discharge',
        admission_id: 'ADM_123',
        final_diagnosis: 'Recovered',
        treatment_given: 'IV antibiotics',
        follow_up_date: '2026-04-01',
        medications_on_discharge: [
          { medicine: 'Amoxicillin', dosage: '500mg', frequency: 'TID', duration: '7 days' },
        ],
      })
      expect(result.success).toBe(true)
    })
  })

  describe('add-nursing-note', () => {
    it('should validate vitals type', () => {
      const result = ipdActionSchema.safeParse({
        action: 'add-nursing-note',
        admission_id: 'ADM_123',
        type: 'vitals',
        note: 'Patient stable',
        vitals: { bp_systolic: 120, bp_diastolic: 80, pulse: 72, spo2: 98 },
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid vitals ranges', () => {
      const result = ipdActionSchema.safeParse({
        action: 'add-nursing-note',
        admission_id: 'ADM_123',
        type: 'vitals',
        note: 'test',
        vitals: { bp_systolic: 500 }, // max is 300
      })
      expect(result.success).toBe(false)
    })

    it('should validate all note types', () => {
      for (const type of ['vitals', 'observation', 'medication', 'general', 'rounds']) {
        const result = ipdActionSchema.safeParse({
          action: 'add-nursing-note',
          admission_id: 'ADM_123',
          type,
          note: 'Test note',
        })
        expect(result.success).toBe(true)
      }
    })
  })

  describe('add-daily-charge', () => {
    it('should validate a charge', () => {
      const result = ipdActionSchema.safeParse({
        action: 'add-daily-charge',
        admission_id: 'ADM_123',
        description: 'Room charge',
        amount: 2000,
        category: 'bed',
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid category', () => {
      const result = ipdActionSchema.safeParse({
        action: 'add-daily-charge',
        admission_id: 'ADM_123',
        description: 'Test',
        amount: 100,
        category: 'invalid',
      })
      expect(result.success).toBe(false)
    })

    it('should reject negative amount', () => {
      const result = ipdActionSchema.safeParse({
        action: 'add-daily-charge',
        admission_id: 'ADM_123',
        description: 'Test',
        amount: -500,
        category: 'medicine',
      })
      expect(result.success).toBe(false)
    })
  })
})

// ─── Billing Action Schema ──────────────────────────────────────────────────

describe('billingActionSchema', () => {
  describe('generate-invoice', () => {
    it('should validate a valid invoice', () => {
      const result = billingActionSchema.safeParse({
        action: 'generate-invoice',
        patient_phone: '9876543210',
        patient_name: 'Jane Doe',
        type: 'consultation',
        items: [{ description: 'Consultation fee', amount: 500, quantity: 1 }],
      })
      expect(result.success).toBe(true)
    })

    it('should accept all invoice types', () => {
      for (const type of ['consultation', 'pharmacy', 'lab', 'admission', 'procedure']) {
        const result = billingActionSchema.safeParse({
          action: 'generate-invoice',
          patient_phone: '9876543210',
          patient_name: 'Test',
          type,
          items: [{ description: 'Item', amount: 100, quantity: 1 }],
        })
        expect(result.success).toBe(true)
      }
    })

    it('should reject empty items array', () => {
      const result = billingActionSchema.safeParse({
        action: 'generate-invoice',
        patient_phone: '9876543210',
        patient_name: 'Test',
        type: 'consultation',
        items: [],
      })
      expect(result.success).toBe(false)
    })

    it('should default quantity to 1', () => {
      const result = billingActionSchema.safeParse({
        action: 'generate-invoice',
        patient_phone: '9876543210',
        patient_name: 'Test',
        type: 'lab',
        items: [{ description: 'Blood test', amount: 300 }],
      })
      expect(result.success).toBe(true)
      if (result.success && result.data.action === 'generate-invoice') {
        expect(result.data.items[0].quantity).toBe(1)
      }
    })

    it('should accept discount options', () => {
      const result = billingActionSchema.safeParse({
        action: 'generate-invoice',
        patient_phone: '9876543210',
        patient_name: 'Test',
        type: 'consultation',
        items: [{ description: 'Fee', amount: 1000, quantity: 1 }],
        discount_type: 'percent',
        discount_value: 10,
      })
      expect(result.success).toBe(true)
    })

    it('should strip HTML from description', () => {
      const result = billingActionSchema.safeParse({
        action: 'generate-invoice',
        patient_phone: '9876543210',
        patient_name: 'Test',
        type: 'consultation',
        items: [{ description: '<b>Bold</b> fee', amount: 500, quantity: 1 }],
      })
      expect(result.success).toBe(true)
      if (result.success && result.data.action === 'generate-invoice') {
        expect(result.data.items[0].description).toBe('Bold fee')
      }
    })
  })

  describe('update-payment', () => {
    it('should validate payment status update', () => {
      const result = billingActionSchema.safeParse({
        action: 'update-payment',
        invoice_id: 'INV_123',
        payment_status: 'paid',
        payment_method: 'UPI',
      })
      expect(result.success).toBe(true)
    })

    it('should accept all payment statuses', () => {
      for (const payment_status of ['paid', 'unpaid', 'partial']) {
        const result = billingActionSchema.safeParse({
          action: 'update-payment',
          invoice_id: 'INV_123',
          payment_status,
        })
        expect(result.success).toBe(true)
      }
    })
  })

  describe('get-invoice', () => {
    it('should validate invoice lookup', () => {
      const result = billingActionSchema.safeParse({
        action: 'get-invoice',
        invoice_id: 'INV_12345',
      })
      expect(result.success).toBe(true)
    })
  })
})

// ─── Lab Action Schema ──────────────────────────────────────────────────────

describe('labActionSchema', () => {
  describe('create-order', () => {
    it('should validate a valid lab order', () => {
      const result = labActionSchema.safeParse({
        action: 'create-order',
        patient_phone: '9876543210',
        patient_name: 'John',
        tests: [{ test_id: 'TEST_001', test_name: 'CBC' }],
      })
      expect(result.success).toBe(true)
    })

    it('should reject empty tests array', () => {
      const result = labActionSchema.safeParse({
        action: 'create-order',
        patient_phone: '9876543210',
        patient_name: 'John',
        tests: [],
      })
      expect(result.success).toBe(false)
    })

    it('should accept optional doctor and booking fields', () => {
      const result = labActionSchema.safeParse({
        action: 'create-order',
        patient_phone: '9876543210',
        patient_name: 'John',
        doctor_id: 'DOC001',
        doctor_name: 'Dr. Smith',
        booking_id: 'BK_123',
        tests: [
          { test_id: 'TEST_001', test_name: 'CBC' },
          { test_id: 'TEST_002', test_name: 'Lipid Profile' },
        ],
        notes: 'Fasting sample required',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('update-status', () => {
    it('should validate valid status transitions', () => {
      for (const status of ['sample_collected', 'processing', 'completed']) {
        const result = labActionSchema.safeParse({
          action: 'update-status',
          order_id: 'LAB_123',
          status,
        })
        expect(result.success).toBe(true)
      }
    })

    it('should reject invalid status', () => {
      const result = labActionSchema.safeParse({
        action: 'update-status',
        order_id: 'LAB_123',
        status: 'invalid_status',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('upload-results', () => {
    it('should validate results upload', () => {
      const result = labActionSchema.safeParse({
        action: 'upload-results',
        order_id: 'LAB_123',
        results: {
          'Hemoglobin': { value: 14.5, unit: 'g/dL', normal_range: '13-17' },
          'WBC': { value: 8000, unit: '/cumm', normal_range: '4000-11000' },
        },
      })
      expect(result.success).toBe(true)
    })
  })

  describe('manage-test', () => {
    it('should validate test master creation', () => {
      const result = labActionSchema.safeParse({
        action: 'manage-test',
        operation: 'create',
        test_name: 'Complete Blood Count',
        price: 350,
        category: 'Hematology',
        sample_type: 'Blood',
        normal_range: 'Varies by parameter',
        turnaround_hours: 24,
      })
      expect(result.success).toBe(true)
    })

    it('should validate test master update', () => {
      const result = labActionSchema.safeParse({
        action: 'manage-test',
        operation: 'update',
        test_id: 'TEST_001',
        test_name: 'CBC with ESR',
        price: 450,
      })
      expect(result.success).toBe(true)
    })

    it('should reject negative price', () => {
      const result = labActionSchema.safeParse({
        action: 'manage-test',
        operation: 'create',
        test_name: 'Test',
        price: -100,
      })
      expect(result.success).toBe(false)
    })
  })
})

// ─── Pharmacy Action Schema ────────────────────────────────────────────────

describe('pharmacyActionSchema', () => {
  describe('create-order', () => {
    it('should validate a pharmacy order', () => {
      const result = pharmacyActionSchema.safeParse({
        action: 'create-order',
        items: [
          { medicine_name: 'Paracetamol 500mg', dosage: '500mg', frequency: 'TID', duration: '5 days', quantity: 15 },
        ],
      })
      expect(result.success).toBe(true)
    })

    it('should reject empty items', () => {
      const result = pharmacyActionSchema.safeParse({
        action: 'create-order',
        items: [],
      })
      expect(result.success).toBe(false)
    })

    it('should accept optional patient and prescription fields', () => {
      const result = pharmacyActionSchema.safeParse({
        action: 'create-order',
        prescription_id: 'RX_123',
        patient_phone: '9876543210',
        patient_name: 'Jane',
        doctor_name: 'Dr. Kumar',
        items: [
          { medicine_name: 'Amoxicillin', dosage: '250mg', frequency: 'BID', duration: '7 days' },
        ],
      })
      expect(result.success).toBe(true)
    })
  })

  describe('update-status', () => {
    it('should validate all status transitions', () => {
      for (const status of ['preparing', 'ready', 'dispensed']) {
        const result = pharmacyActionSchema.safeParse({
          action: 'update-status',
          order_id: 'PO_123',
          status,
        })
        expect(result.success).toBe(true)
      }
    })

    it('should reject invalid status', () => {
      const result = pharmacyActionSchema.safeParse({
        action: 'update-status',
        order_id: 'PO_123',
        status: 'cancelled',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('update-stock', () => {
    it('should validate stock update', () => {
      const result = pharmacyActionSchema.safeParse({
        action: 'update-stock',
        medicine_id: 'MED_001',
        stock: 100,
      })
      expect(result.success).toBe(true)
    })

    it('should accept optional price', () => {
      const result = pharmacyActionSchema.safeParse({
        action: 'update-stock',
        medicine_id: 'MED_001',
        stock: 50,
        price: 25.50,
      })
      expect(result.success).toBe(true)
    })

    it('should reject negative stock', () => {
      const result = pharmacyActionSchema.safeParse({
        action: 'update-stock',
        medicine_id: 'MED_001',
        stock: -5,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('manage-medicine', () => {
    it('should validate medicine creation', () => {
      const result = pharmacyActionSchema.safeParse({
        action: 'manage-medicine',
        operation: 'create',
        medicine_name: 'Paracetamol',
        salt: 'Acetaminophen',
        dosage: '500mg',
        form: 'Tablet',
        stock: 500,
        min_stock: 50,
        price: 5,
        category: 'Analgesic',
        expiry_date: '2027-12-31',
      })
      expect(result.success).toBe(true)
    })

    it('should default stock and min_stock', () => {
      const result = pharmacyActionSchema.safeParse({
        action: 'manage-medicine',
        operation: 'create',
        medicine_name: 'New Medicine',
        price: 10,
      })
      expect(result.success).toBe(true)
      if (result.success && result.data.action === 'manage-medicine') {
        expect(result.data.stock).toBe(0)
        expect(result.data.min_stock).toBe(10)
      }
    })
  })
})

// ─── Analytics Query Schema ─────────────────────────────────────────────────

describe('analyticsQuerySchema', () => {
  it('should validate all metric types', () => {
    const metrics = [
      'dashboard-summary',
      'revenue-by-type',
      'revenue-by-doctor',
      'appointment-stats',
      'patient-demographics',
    ]
    for (const metric of metrics) {
      const result = analyticsQuerySchema.safeParse({ metric })
      expect(result.success).toBe(true)
    }
  })

  it('should accept date range', () => {
    const result = analyticsQuerySchema.safeParse({
      metric: 'dashboard-summary',
      from_date: '2026-03-01',
      to_date: '2026-03-19',
    })
    expect(result.success).toBe(true)
  })

  it('should reject invalid metric', () => {
    const result = analyticsQuerySchema.safeParse({
      metric: 'invalid-metric',
    })
    expect(result.success).toBe(false)
  })

  it('should reject invalid date format', () => {
    const result = analyticsQuerySchema.safeParse({
      metric: 'dashboard-summary',
      from_date: '19/03/2026',
    })
    expect(result.success).toBe(false)
  })

  it('should accept tenant_id for cross-tenant queries', () => {
    const result = analyticsQuerySchema.safeParse({
      metric: 'revenue-by-type',
      tenant_id: 'T001',
    })
    expect(result.success).toBe(true)
  })
})
