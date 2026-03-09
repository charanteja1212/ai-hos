/**
 * WhatsApp Bot Tool Executors
 * Call n8n webhook endpoints for the 9 patient management tools
 */

const TOOL_WEBHOOK_MAP: Record<string, string> = {
  lookup_patient: 'https://ainewworld.in/webhook/patient-lookup',
  save_patient: 'https://ainewworld.in/webhook/save-patient',
  list_specialties: 'https://ainewworld.in/webhook/list-specialties',
  check_availability_7days: 'https://ainewworld.in/webhook/cal-availability',
  book_appointment: 'https://ainewworld.in/webhook/book-appointment',
  cancel_appointment: 'https://ainewworld.in/webhook/cancel-appointment',
  list_appointments: 'https://ainewworld.in/webhook/list-appointments',
  check_op_pass: 'https://ainewworld.in/webhook/check-op-pass',
  reschedule_appointment: 'https://ainewworld.in/webhook/reschedule-appointment',
};

/**
 * Call an n8n tool webhook endpoint
 */
export async function callTool(
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: Record<string, any>,
  tenantId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const url = TOOL_WEBHOOK_MAP[name];
  if (!url) {
    return { error: 'Unknown tool: ' + name };
  }

  // Always include tenant_id
  args.tenant_id = tenantId;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown error');
      return { error: `Tool ${name} HTTP ${res.status}: ${errText.substring(0, 200)}` };
    }

    return await res.json();
  } catch (err) {
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
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1';
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  try {
    const res = await fetch(SUPABASE_URL + '/dependents', {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        dependent_id: 'DEP' + Date.now(),
        ...dependentData,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const result = await res.json();
      if (Array.isArray(result) && result.length > 0) {
        return result[0].dependent_id;
      }
    }
    return null;
  } catch {
    return null;
  }
}
