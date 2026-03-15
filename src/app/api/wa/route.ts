/**
 * POST /api/wa — Authenticated API for WhatsApp web pages
 * Validates token, then dispatches to tool-handlers.
 * Body: { token, action, ...params }
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyWaToken } from "@/lib/whatsapp/wa-token";
import {
  lookupPatient,
  savePatient,
  listSpecialties,
  checkAvailability7Days,
  bookAppointment,
  listAppointments,
  cancelAppointment,
  listPrescriptions,
} from "@/lib/whatsapp/tool-handlers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, action, ...params } = body;

    if (!token || !action) {
      return NextResponse.json({ error: "Missing token or action" }, { status: 400 });
    }

    // Verify token
    const auth = await verifyWaToken(token);
    if (!auth) {
      return NextResponse.json({ error: "Invalid or expired token. Please go back to WhatsApp and tap the link again." }, { status: 401 });
    }

    const { phone, tenantId } = auth;

    // Dispatch to tool handlers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any;

    switch (action) {
      case "lookup_patient":
        result = await lookupPatient({ phone, tenant_id: tenantId });
        break;

      case "save_patient":
        result = await savePatient({
          phone,
          tenant_id: tenantId,
          name: params.name,
          age: params.age,
          email: params.email,
          address: params.address,
          gender: params.gender,
        });
        break;

      case "list_specialties":
        result = await listSpecialties({ tenant_id: tenantId });
        break;

      case "check_availability":
        result = await checkAvailability7Days({
          doctor_id: params.doctor_id,
          patient_phone: phone,
          tenant_id: tenantId,
          exclude_appointment_id: params.exclude_appointment_id,
        });
        break;

      case "book_appointment":
        result = await bookAppointment({
          phone: params.patient_phone || phone,
          name: params.patient_name,
          age: params.age,
          start_time: params.start_time,
          doctor_id: params.doctor_id,
          doctor_name: params.doctor_name,
          specialty: params.specialty,
          patient_type: params.patient_type || "SELF",
          dependent_id: params.dependent_id,
          booked_by_whatsapp_number: phone,
          relationship_to_patient: params.relationship || "SELF",
          tenant_id: tenantId,
          source: "whatsapp_web",
        });
        break;

      case "list_appointments":
        result = await listAppointments({ phone, tenant_id: tenantId });
        break;

      case "cancel_appointment":
        result = await cancelAppointment({
          booking_id: params.booking_id,
          sender_phone: phone,
          tenant_id: tenantId,
        });
        break;

      case "list_prescriptions":
        result = await listPrescriptions({ phone, tenant_id: tenantId });
        break;

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/wa] Error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
