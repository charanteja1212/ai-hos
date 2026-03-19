import { describe, it, expect } from 'vitest'
import { parseWebhookPayload, isStatusUpdate } from '@/lib/whatsapp/parser'

// Helper to build a minimal Meta webhook body
function makeWebhookBody(message: Record<string, unknown>) {
  return {
    entry: [{
      changes: [{
        value: {
          metadata: { phone_number_id: 'PHONE_ID_123' },
          messages: [{ from: '919876543210', id: 'wamid_abc', ...message }],
        },
      }],
    }],
  }
}

describe('parseWebhookPayload', () => {
  it('should parse a text message', () => {
    const body = makeWebhookBody({
      type: 'text',
      text: { body: 'Hello doctor' },
    })
    const result = parseWebhookPayload(body)
    expect(result).not.toBeNull()
    expect(result!.senderPhone).toBe('919876543210')
    expect(result!.messageBody).toBe('Hello doctor')
    expect(result!.messageId).toBe('wamid_abc')
    expect(result!.receiverPhoneId).toBe('PHONE_ID_123')
    expect(result!.messageType).toBe('text')
  })

  it('should parse an interactive button reply', () => {
    const body = makeWebhookBody({
      type: 'interactive',
      interactive: {
        type: 'button_reply',
        button_reply: { id: 'lang_en', title: 'English' },
      },
    })
    const result = parseWebhookPayload(body)
    expect(result).not.toBeNull()
    expect(result!.messageBody).toBe('lang_en')
    expect(result!.messageType).toBe('button_reply')
  })

  it('should parse an interactive list reply', () => {
    const body = makeWebhookBody({
      type: 'interactive',
      interactive: {
        type: 'list_reply',
        list_reply: { id: 'book_self', title: 'Book Appointment' },
      },
    })
    const result = parseWebhookPayload(body)
    expect(result).not.toBeNull()
    expect(result!.messageBody).toBe('book_self')
    expect(result!.messageType).toBe('list_reply')
  })

  it('should parse NFM reply with registration flow', () => {
    const body = makeWebhookBody({
      type: 'interactive',
      interactive: {
        type: 'nfm_reply',
        nfm_reply: {
          response_json: JSON.stringify({
            screen: 'REGISTRATION',
            name: 'John Doe',
            age: '30',
            email: 'john@test.com',
            gender: 'Male',
          }),
        },
      },
    })
    const result = parseWebhookPayload(body)
    expect(result).not.toBeNull()
    expect(result!.messageType).toBe('nfm_reply')
    expect(result!.messageBody).toContain('REGISTRATION_DATA:')
    expect(result!.messageBody).toContain('Name: John Doe')
    expect(result!.messageBody).toContain('Age: 30')
    expect(result!.messageBody).toContain('Email: john@test.com')
    expect(result!.messageBody).toContain('Gender: Male')
    expect(result!.nfmResponseData).toBeDefined()
    expect(result!.nfmResponseData.name).toBe('John Doe')
  })

  it('should parse NFM reply with dependent registration flow', () => {
    const body = makeWebhookBody({
      type: 'interactive',
      interactive: {
        type: 'nfm_reply',
        nfm_reply: {
          response_json: JSON.stringify({
            screen: 'DEPENDENT_REG',
            name: 'Jane Doe',
            age: '5',
            address: '123 St',
            reason: 'Fever',
          }),
        },
      },
    })
    const result = parseWebhookPayload(body)
    expect(result).not.toBeNull()
    expect(result!.messageBody).toContain('DEPENDENT_DATA:')
    expect(result!.messageBody).toContain('Name: Jane Doe')
    expect(result!.messageBody).toContain('Reason: Fever')
  })

  it('should parse NFM reply with flow_token registration', () => {
    const body = makeWebhookBody({
      type: 'interactive',
      interactive: {
        type: 'nfm_reply',
        nfm_reply: {
          response_json: JSON.stringify({
            flow_token: 'reg_abc123',
            name: 'Flow User',
            age: '25',
          }),
        },
      },
    })
    const result = parseWebhookPayload(body)
    expect(result).not.toBeNull()
    expect(result!.messageBody).toContain('REGISTRATION_DATA:')
    expect(result!.messageBody).toContain('Name: Flow User')
  })

  it('should handle NFM reply with unknown screen (JSON stringify)', () => {
    const body = makeWebhookBody({
      type: 'interactive',
      interactive: {
        type: 'nfm_reply',
        nfm_reply: {
          response_json: JSON.stringify({ screen: 'UNKNOWN', foo: 'bar' }),
        },
      },
    })
    const result = parseWebhookPayload(body)
    expect(result).not.toBeNull()
    expect(result!.messageBody).toContain('"foo":"bar"')
  })

  it('should handle NFM reply with non-JSON response', () => {
    const body = makeWebhookBody({
      type: 'interactive',
      interactive: {
        type: 'nfm_reply',
        nfm_reply: { response_json: 'not valid json{{{' },
      },
    })
    const result = parseWebhookPayload(body)
    expect(result).not.toBeNull()
    expect(result!.messageBody).toBe('not valid json{{{')
  })

  it('should parse template button reply', () => {
    const body = makeWebhookBody({
      type: 'button',
      button: { text: 'Yes', payload: 'confirm_yes' },
    })
    const result = parseWebhookPayload(body)
    expect(result).not.toBeNull()
    expect(result!.messageBody).toBe('Yes')
    expect(result!.messageType).toBe('button_reply')
  })

  it('should handle unknown message type', () => {
    const body = makeWebhookBody({ type: 'image' })
    const result = parseWebhookPayload(body)
    expect(result).not.toBeNull()
    expect(result!.messageBody).toBe('')
    expect(result!.messageType).toBe('unknown')
  })

  it('should return null for empty body', () => {
    expect(parseWebhookPayload({})).toBeNull()
    expect(parseWebhookPayload(null)).toBeNull()
    expect(parseWebhookPayload(undefined)).toBeNull()
  })

  it('should return null for no messages array', () => {
    const body = {
      entry: [{
        changes: [{
          value: {
            metadata: { phone_number_id: 'PID' },
            // no messages
          },
        }],
      }],
    }
    expect(parseWebhookPayload(body)).toBeNull()
  })

  it('should return null for empty messages array', () => {
    const body = {
      entry: [{
        changes: [{
          value: {
            metadata: { phone_number_id: 'PID' },
            messages: [],
          },
        }],
      }],
    }
    expect(parseWebhookPayload(body)).toBeNull()
  })

  it('should return null when senderPhone is missing', () => {
    const body = {
      entry: [{
        changes: [{
          value: {
            metadata: { phone_number_id: 'PID' },
            messages: [{ id: 'wamid_1', type: 'text', text: { body: 'hi' } }],
            // no from field
          },
        }],
      }],
    }
    expect(parseWebhookPayload(body)).toBeNull()
  })

  it('should use button_reply id over title when both exist', () => {
    const body = makeWebhookBody({
      type: 'interactive',
      interactive: {
        type: 'button_reply',
        button_reply: { id: 'btn_id', title: 'Button Title' },
      },
    })
    const result = parseWebhookPayload(body)
    expect(result!.messageBody).toBe('btn_id')
  })

  it('should fall back to title when button_reply id is missing', () => {
    const body = makeWebhookBody({
      type: 'interactive',
      interactive: {
        type: 'button_reply',
        button_reply: { title: 'Only Title' },
      },
    })
    const result = parseWebhookPayload(body)
    expect(result!.messageBody).toBe('Only Title')
  })
})

describe('isStatusUpdate', () => {
  it('should return true for status update with no messages', () => {
    const body = {
      entry: [{
        changes: [{
          value: {
            statuses: [{ id: 'wamid_1', status: 'delivered' }],
          },
        }],
      }],
    }
    expect(isStatusUpdate(body)).toBe(true)
  })

  it('should return false for message payload', () => {
    const body = makeWebhookBody({ type: 'text', text: { body: 'hi' } })
    expect(isStatusUpdate(body)).toBe(false)
  })

  it('should return false for empty payload', () => {
    expect(isStatusUpdate({})).toBe(false)
    expect(isStatusUpdate(null)).toBe(false)
  })

  it('should return false when both statuses and messages exist', () => {
    const body = {
      entry: [{
        changes: [{
          value: {
            statuses: [{ id: 'wamid_1', status: 'delivered' }],
            messages: [{ from: '91987654', id: 'wamid_2', type: 'text' }],
          },
        }],
      }],
    }
    expect(isStatusUpdate(body)).toBe(false)
  })

  it('should return false for empty statuses array', () => {
    const body = {
      entry: [{
        changes: [{
          value: { statuses: [] },
        }],
      }],
    }
    expect(isStatusUpdate(body)).toBe(false)
  })
})
