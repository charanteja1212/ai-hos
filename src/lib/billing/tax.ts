/**
 * GST Billing Utility
 *
 * Calculates GST (CGST + SGST for intra-state, IGST for inter-state),
 * applies discounts (flat or percentage), and builds invoice totals.
 *
 * Indian GST rules:
 * - Healthcare services (SAC 9993) are GST-exempt for clinical services
 * - Pharmacy items attract 5%/12%/18% GST based on schedule
 * - Hospital-level GST config stored in tenants table
 * - For simplicity, we use a single tenant-level GST rate
 */

export interface TenantTaxConfig {
  enable_gst: boolean
  gst_percentage: number // e.g. 18 for 18%
  gstin?: string
  hsn_code?: string
  state_code?: string
}

export interface DiscountInput {
  type: "flat" | "percent"
  value: number // flat amount in Rs or percentage value
}

export interface InvoiceTotals {
  subtotal: number
  discount: number
  discount_type: "flat" | "percent"
  discount_value: number
  taxable_amount: number // subtotal - discount
  cgst: number
  sgst: number
  igst: number
  tax: number // total tax (cgst + sgst or igst)
  gst_percentage: number
  total: number // taxable_amount + tax
  gstin?: string
  hsn_code?: string
}

/**
 * Calculate invoice totals with GST and discount
 */
export function calculateInvoiceTotals(
  items: { amount: number; quantity: number }[],
  taxConfig: TenantTaxConfig | null,
  discount?: DiscountInput,
  isInterState = false
): InvoiceTotals {
  // Calculate subtotal from line items
  const subtotal = items.reduce((sum, item) => sum + item.amount * item.quantity, 0)

  // Apply discount
  let discountAmount = 0
  const discountType = discount?.type || "flat"
  const discountValue = discount?.value || 0

  if (discount && discount.value > 0) {
    if (discount.type === "percent") {
      discountAmount = Math.round((subtotal * discount.value) / 100 * 100) / 100
    } else {
      discountAmount = Math.min(discount.value, subtotal) // Can't discount more than subtotal
    }
  }

  const taxableAmount = Math.max(0, subtotal - discountAmount)

  // Calculate GST
  let cgst = 0
  let sgst = 0
  let igst = 0
  const gstPercentage = taxConfig?.enable_gst ? (taxConfig.gst_percentage || 0) : 0

  if (gstPercentage > 0) {
    const totalGst = Math.round((taxableAmount * gstPercentage) / 100 * 100) / 100
    if (isInterState) {
      igst = totalGst
    } else {
      // Intra-state: split equally into CGST + SGST
      cgst = Math.round((totalGst / 2) * 100) / 100
      sgst = Math.round((totalGst / 2) * 100) / 100
    }
  }

  const tax = cgst + sgst + igst
  const total = Math.round((taxableAmount + tax) * 100) / 100

  return {
    subtotal,
    discount: discountAmount,
    discount_type: discountType,
    discount_value: discountValue,
    taxable_amount: taxableAmount,
    cgst,
    sgst,
    igst,
    tax,
    gst_percentage: gstPercentage,
    total,
    gstin: taxConfig?.gstin,
    hsn_code: taxConfig?.hsn_code,
  }
}

/**
 * Build invoice insert data with GST fields
 */
export function buildInvoiceData(
  base: {
    invoice_id: string
    tenant_id: string
    patient_phone: string
    patient_name?: string
    type: "consultation" | "pharmacy" | "lab" | "admission" | "procedure"
    items: { description: string; amount: number; quantity: number }[]
    payment_status?: "unpaid" | "paid" | "partial"
    booking_id?: string
    admission_id?: string
  },
  taxConfig: TenantTaxConfig | null,
  discount?: DiscountInput
) {
  const totals = calculateInvoiceTotals(base.items, taxConfig, discount)

  return {
    ...base,
    subtotal: totals.subtotal,
    tax: totals.tax,
    discount: totals.discount,
    total: totals.total,
    cgst: totals.cgst,
    sgst: totals.sgst,
    igst: totals.igst,
    gst_percentage: totals.gst_percentage,
    discount_type: totals.discount_type,
    discount_value: totals.discount_value,
    gstin: totals.gstin || null,
    hsn_code: totals.hsn_code || null,
    payment_status: base.payment_status || "unpaid",
  }
}

/**
 * Format currency in Indian format
 */
export function formatINR(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
