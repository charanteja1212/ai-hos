import { describe, it, expect } from 'vitest'
import {
  calculateInvoiceTotals,
  buildInvoiceData,
  formatINR,
  type TenantTaxConfig,
  type DiscountInput,
} from '@/lib/billing/tax'

const gstConfig: TenantTaxConfig = {
  enable_gst: true,
  gst_percentage: 18,
  gstin: '29AADCB2230M1ZT',
  hsn_code: '9993',
  state_code: '29',
}

const noGstConfig: TenantTaxConfig = {
  enable_gst: false,
  gst_percentage: 0,
}

describe('calculateInvoiceTotals', () => {
  describe('basic calculations', () => {
    it('should calculate subtotal from line items', () => {
      const items = [
        { amount: 500, quantity: 1 },
        { amount: 200, quantity: 2 },
      ]
      const result = calculateInvoiceTotals(items, noGstConfig)
      expect(result.subtotal).toBe(900) // 500 + 400
      expect(result.total).toBe(900)
      expect(result.tax).toBe(0)
    })

    it('should handle single item', () => {
      const result = calculateInvoiceTotals(
        [{ amount: 1000, quantity: 1 }],
        noGstConfig
      )
      expect(result.subtotal).toBe(1000)
      expect(result.total).toBe(1000)
    })

    it('should handle empty items array', () => {
      const result = calculateInvoiceTotals([], noGstConfig)
      expect(result.subtotal).toBe(0)
      expect(result.total).toBe(0)
    })
  })

  describe('GST calculations (intra-state)', () => {
    it('should split GST into CGST + SGST for intra-state', () => {
      const items = [{ amount: 1000, quantity: 1 }]
      const result = calculateInvoiceTotals(items, gstConfig)
      expect(result.gst_percentage).toBe(18)
      expect(result.taxable_amount).toBe(1000)
      expect(result.tax).toBe(180) // 18% of 1000
      expect(result.cgst).toBe(90)  // 9%
      expect(result.sgst).toBe(90)  // 9%
      expect(result.igst).toBe(0)
      expect(result.total).toBe(1180)
    })

    it('should include GSTIN and HSN code', () => {
      const result = calculateInvoiceTotals(
        [{ amount: 100, quantity: 1 }],
        gstConfig
      )
      expect(result.gstin).toBe('29AADCB2230M1ZT')
      expect(result.hsn_code).toBe('9993')
    })
  })

  describe('GST calculations (inter-state)', () => {
    it('should use full IGST for inter-state', () => {
      const items = [{ amount: 1000, quantity: 1 }]
      const result = calculateInvoiceTotals(items, gstConfig, undefined, true)
      expect(result.igst).toBe(180) // full 18%
      expect(result.cgst).toBe(0)
      expect(result.sgst).toBe(0)
      expect(result.tax).toBe(180)
      expect(result.total).toBe(1180)
    })
  })

  describe('GST disabled', () => {
    it('should not apply GST when disabled', () => {
      const result = calculateInvoiceTotals(
        [{ amount: 1000, quantity: 1 }],
        noGstConfig
      )
      expect(result.gst_percentage).toBe(0)
      expect(result.tax).toBe(0)
      expect(result.cgst).toBe(0)
      expect(result.sgst).toBe(0)
      expect(result.igst).toBe(0)
      expect(result.total).toBe(1000)
    })

    it('should handle null tax config', () => {
      const result = calculateInvoiceTotals(
        [{ amount: 1000, quantity: 1 }],
        null
      )
      expect(result.gst_percentage).toBe(0)
      expect(result.tax).toBe(0)
      expect(result.total).toBe(1000)
    })
  })

  describe('discount calculations', () => {
    it('should apply flat discount', () => {
      const discount: DiscountInput = { type: 'flat', value: 200 }
      const result = calculateInvoiceTotals(
        [{ amount: 1000, quantity: 1 }],
        noGstConfig,
        discount
      )
      expect(result.subtotal).toBe(1000)
      expect(result.discount).toBe(200)
      expect(result.discount_type).toBe('flat')
      expect(result.discount_value).toBe(200)
      expect(result.taxable_amount).toBe(800)
      expect(result.total).toBe(800)
    })

    it('should apply percentage discount', () => {
      const discount: DiscountInput = { type: 'percent', value: 10 }
      const result = calculateInvoiceTotals(
        [{ amount: 1000, quantity: 1 }],
        noGstConfig,
        discount
      )
      expect(result.discount).toBe(100) // 10% of 1000
      expect(result.taxable_amount).toBe(900)
      expect(result.total).toBe(900)
    })

    it('should cap flat discount at subtotal', () => {
      const discount: DiscountInput = { type: 'flat', value: 2000 }
      const result = calculateInvoiceTotals(
        [{ amount: 500, quantity: 1 }],
        noGstConfig,
        discount
      )
      expect(result.discount).toBe(500) // capped at subtotal
      expect(result.taxable_amount).toBe(0)
      expect(result.total).toBe(0)
    })

    it('should apply GST after discount', () => {
      const discount: DiscountInput = { type: 'flat', value: 500 }
      const result = calculateInvoiceTotals(
        [{ amount: 1000, quantity: 1 }],
        gstConfig,
        discount
      )
      expect(result.taxable_amount).toBe(500) // 1000 - 500
      expect(result.tax).toBe(90) // 18% of 500
      expect(result.total).toBe(590) // 500 + 90
    })

    it('should not discount when value is 0', () => {
      const discount: DiscountInput = { type: 'flat', value: 0 }
      const result = calculateInvoiceTotals(
        [{ amount: 1000, quantity: 1 }],
        noGstConfig,
        discount
      )
      expect(result.discount).toBe(0)
      expect(result.taxable_amount).toBe(1000)
    })
  })

  describe('edge cases', () => {
    it('should handle fractional amounts correctly', () => {
      const result = calculateInvoiceTotals(
        [{ amount: 333.33, quantity: 3 }],
        gstConfig
      )
      // 333.33 * 3 = 999.99
      expect(result.subtotal).toBeCloseTo(999.99, 2)
      expect(result.total).toBeGreaterThan(result.subtotal) // GST adds
    })

    it('should handle 5% GST rate', () => {
      const config5: TenantTaxConfig = { enable_gst: true, gst_percentage: 5 }
      const result = calculateInvoiceTotals(
        [{ amount: 200, quantity: 1 }],
        config5
      )
      expect(result.tax).toBe(10) // 5% of 200
      expect(result.cgst).toBe(5)
      expect(result.sgst).toBe(5)
    })
  })
})

describe('buildInvoiceData', () => {
  it('should build complete invoice with GST', () => {
    const result = buildInvoiceData(
      {
        invoice_id: 'INV-001',
        tenant_id: 'tenant-1',
        patient_phone: '9876543210',
        patient_name: 'John',
        type: 'consultation',
        items: [{ description: 'Consultation Fee', amount: 500, quantity: 1 }],
      },
      gstConfig
    )
    expect(result.invoice_id).toBe('INV-001')
    expect(result.subtotal).toBe(500)
    expect(result.tax).toBe(90)
    expect(result.total).toBe(590)
    expect(result.cgst).toBe(45)
    expect(result.sgst).toBe(45)
    expect(result.gstin).toBe('29AADCB2230M1ZT')
    expect(result.payment_status).toBe('unpaid')
  })

  it('should default payment_status to unpaid', () => {
    const result = buildInvoiceData(
      {
        invoice_id: 'INV-002',
        tenant_id: 'tenant-1',
        patient_phone: '9876543210',
        type: 'pharmacy',
        items: [{ description: 'Medicine', amount: 100, quantity: 1 }],
      },
      null
    )
    expect(result.payment_status).toBe('unpaid')
  })

  it('should preserve payment_status when provided', () => {
    const result = buildInvoiceData(
      {
        invoice_id: 'INV-003',
        tenant_id: 'tenant-1',
        patient_phone: '9876543210',
        type: 'lab',
        items: [{ description: 'Blood Test', amount: 300, quantity: 1 }],
        payment_status: 'paid',
      },
      null
    )
    expect(result.payment_status).toBe('paid')
  })

  it('should apply discount when provided', () => {
    const result = buildInvoiceData(
      {
        invoice_id: 'INV-004',
        tenant_id: 'tenant-1',
        patient_phone: '9876543210',
        type: 'consultation',
        items: [{ description: 'Fee', amount: 1000, quantity: 1 }],
      },
      gstConfig,
      { type: 'percent', value: 10 }
    )
    expect(result.subtotal).toBe(1000)
    expect(result.discount).toBe(100)
    expect(result.total).toBe(1062) // (1000-100) + 18% of 900 = 900 + 162
  })
})

describe('formatINR', () => {
  it('should format with rupee symbol and two decimals', () => {
    expect(formatINR(500)).toBe('₹500.00')
  })

  it('should format large number with Indian grouping', () => {
    const result = formatINR(100000)
    expect(result).toContain('₹')
    expect(result).toContain('1,00,000.00')
  })

  it('should format zero', () => {
    expect(formatINR(0)).toBe('₹0.00')
  })

  it('should format decimal amount', () => {
    expect(formatINR(99.5)).toBe('₹99.50')
  })
})
