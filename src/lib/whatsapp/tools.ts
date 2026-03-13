/**
 * WhatsApp Bot Tool Executors
 * Routes tool calls to local handlers (direct Supabase operations).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  lookupPatient,
  savePatient,
  listSpecialties,
  checkAvailability7Days,
  bookAppointment,
  cancelAppointment,
  listAppointments,
  checkOpPass,
  rescheduleAppointment,
  saveDependent,
} from './tool-handlers';

const TOOL_HANDLERS: Record<string, (args: any) => Promise<any>> = {
  lookup_patient: lookupPatient,
  save_patient: savePatient,
  list_specialties: listSpecialties,
  check_availability_7days: checkAvailability7Days,
  book_appointment: bookAppointment,
  cancel_appointment: cancelAppointment,
  list_appointments: listAppointments,
  check_op_pass: checkOpPass,
  reschedule_appointment: rescheduleAppointment,
  save_dependent: saveDependent,
};

/**
 * Call a tool handler directly (no n8n dependency)
 */
export async function callTool(
  name: string,
  args: Record<string, any>,
  tenantId: string
): Promise<any> {
  const handler = TOOL_HANDLERS[name];
  if (!handler) {
    return { error: 'Unknown tool: ' + name };
  }

  // Always include tenant_id
  args.tenant_id = tenantId;

  try {
    return await handler(args);
  } catch (err) {
    console.error('[tools] ' + name + ' error:', err);
    return { error: 'Tool ' + name + ' failed: ' + (err instanceof Error ? err.message : String(err)) };
  }
}

/**
 * Save a dependent record directly to Supabase
 */
export async function saveDependentRecord(
  dependentData: {
    linked_phone: string;
    name: string;
    age: number | null;
    address: string | null;
    reason: string | null;
    tenant_id: string;
  }
): Promise<string | null> {
  try {
    const result = await saveDependent(dependentData);
    return result.success ? result.dependent_id : null;
  } catch {
    return null;
  }
}
