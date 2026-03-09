/**
 * WhatsApp Message Deduplication
 * Uses Supabase wa_dedup table to prevent processing duplicate messages
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': 'Bearer ' + SUPABASE_KEY,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

/**
 * Check if a message ID has already been processed.
 * If not, insert it into the dedup table.
 * Returns true if the message is a duplicate (already processed).
 */
export async function isDuplicate(messageId: string): Promise<boolean> {
  if (!messageId) return false;

  try {
    // Try to insert — if it already exists, Supabase will return a conflict
    const res = await fetch(SUPABASE_URL + '/wa_dedup', {
      method: 'POST',
      headers: {
        ...headers,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        message_id: messageId,
        phone: 'unknown',
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (res.status === 409 || res.status === 23505) {
      // Conflict — already exists, this is a duplicate
      return true;
    }

    if (!res.ok) {
      // If the table doesn't exist or other error, check the error
      const errText = await res.text().catch(() => '');
      if (errText.includes('duplicate') || errText.includes('unique') || errText.includes('23505')) {
        return true;
      }
      // If we can't dedup, allow the message through (fail open)
      console.warn('[dedup] Insert failed:', res.status, errText.substring(0, 200));
      return false;
    }

    // Successfully inserted — not a duplicate
    return false;
  } catch (err) {
    console.error('[dedup] Error:', err);
    // Fail open — allow message through
    return false;
  }
}

/**
 * Cleanup old dedup entries (older than 24 hours).
 * Call this periodically to prevent table from growing indefinitely.
 */
export async function cleanupDedup(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await fetch(SUPABASE_URL + '/wa_dedup?created_at=lt.' + encodeURIComponent(cutoff), {
      method: 'DELETE',
      headers,
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    console.error('[dedup] Cleanup error:', err);
  }
}
