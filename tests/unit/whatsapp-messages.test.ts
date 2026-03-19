import { describe, it, expect } from 'vitest'
import { buildMessagePayloads } from '@/lib/whatsapp/messages'

const emptyConfig = { flow_registration_id: null, flow_dependent_id: null }

describe('buildMessagePayloads', () => {
  describe('plain text messages', () => {
    it('should build a simple text message', () => {
      const result = buildMessagePayloads('Hello patient', '919876543210', 'en', emptyConfig)
      expect(result.sentType).toBe('text')
      expect(result.payloads).toHaveLength(1)
      expect(result.payloads[0].type).toBe('text')
      expect(result.payloads[0].to).toBe('919876543210')
      expect(result.payloads[0].text.body).toBe('Hello patient')
      expect(result.payloads[0].messaging_product).toBe('whatsapp')
    })

    it('should trim whitespace from plain text', () => {
      const result = buildMessagePayloads('  Hello  ', '919876543210', 'en', emptyConfig)
      expect(result.payloads[0].text.body).toBe('Hello')
    })
  })

  describe('language buttons', () => {
    it('should build language selection buttons', () => {
      const reply = 'Please select your language:\n[BUTTONS:language]'
      const result = buildMessagePayloads(reply, '919876543210', 'en', emptyConfig)
      expect(result.sentType).toBe('buttons')
      expect(result.payloads).toHaveLength(1)

      const payload = result.payloads[0]
      expect(payload.type).toBe('interactive')
      expect(payload.interactive.type).toBe('button')
      expect(payload.interactive.action.buttons).toHaveLength(3)

      const btnIds = payload.interactive.action.buttons.map((b: { reply: { id: string } }) => b.reply.id)
      expect(btnIds).toContain('lang_en')
      expect(btnIds).toContain('lang_hi')
      expect(btnIds).toContain('lang_te')
    })

    it('should extract text before [BUTTONS:language] as body', () => {
      const reply = 'Welcome to our hospital!\n[BUTTONS:language]'
      const result = buildMessagePayloads(reply, '919876543210', 'en', emptyConfig)
      expect(result.payloads[0].interactive.body.text).toBe('Welcome to our hospital!')
    })

    it('should use default select_option text when no text before buttons', () => {
      const reply = '[BUTTONS:language]'
      const result = buildMessagePayloads(reply, '919876543210', 'en', emptyConfig)
      expect(result.payloads[0].interactive.body.text).toContain('select')
    })
  })

  describe('unknown button type', () => {
    it('should fall back to text for unknown button type', () => {
      const reply = 'Some text\n[BUTTONS:unknown_type]'
      const result = buildMessagePayloads(reply, '919876543210', 'en', emptyConfig)
      expect(result.sentType).toBe('text')
      expect(result.payloads[0].type).toBe('text')
      // Button marker should be stripped
      expect(result.payloads[0].text.body).not.toContain('[BUTTONS:')
    })
  })

  describe('CTA menu messages', () => {
    it('should parse CTA_MENU format', () => {
      const reply = [
        '[CTA_MENU]',
        'Welcome to our hospital!',
        '[CTA_URL]Book your appointment|Book Now|https://hospital.com/book',
        '[CTA_URL]View your prescriptions|View Rx|https://hospital.com/rx',
        '[CTA_FOOTER]Need help? Reply 7',
      ].join('\n')

      const result = buildMessagePayloads(reply, '919876543210', 'en', emptyConfig)
      expect(result.sentType).toBe('cta_menu')
      // greeting + 2 CTA + footer = 4 payloads
      expect(result.payloads).toHaveLength(4)

      // Greeting
      expect(result.payloads[0].type).toBe('text')
      expect(result.payloads[0].text.body).toContain('Welcome')

      // CTA 1
      expect(result.payloads[1].type).toBe('interactive')
      expect(result.payloads[1].interactive.type).toBe('cta_url')
      expect(result.payloads[1].interactive.action.parameters.url).toBe('https://hospital.com/book')
      expect(result.payloads[1].interactive.action.parameters.display_text).toBe('Book Now')

      // CTA 2
      expect(result.payloads[2].interactive.action.parameters.url).toBe('https://hospital.com/rx')

      // Footer
      expect(result.payloads[3].type).toBe('text')
      expect(result.payloads[3].text.body).toContain('Need help')
    })

    it('should handle CTA_MENU without footer', () => {
      const reply = [
        '[CTA_MENU]',
        'Hello!',
        '[CTA_URL]Body text|Label|https://example.com',
      ].join('\n')

      const result = buildMessagePayloads(reply, '919876543210', 'en', emptyConfig)
      expect(result.sentType).toBe('cta_menu')
      expect(result.payloads).toHaveLength(2) // greeting + 1 CTA
    })

    it('should handle CTA_MENU without greeting', () => {
      const reply = [
        '[CTA_MENU]',
        '[CTA_URL]Body text|Label|https://example.com',
      ].join('\n')

      const result = buildMessagePayloads(reply, '919876543210', 'en', emptyConfig)
      expect(result.sentType).toBe('cta_menu')
      expect(result.payloads).toHaveLength(1) // only CTA, no empty greeting
    })
  })

  describe('null language handling', () => {
    it('should default to en when language is null', () => {
      const result = buildMessagePayloads('Hello', '919876543210', null, emptyConfig)
      expect(result.payloads).toHaveLength(1)
      expect(result.payloads[0].text.body).toBe('Hello')
    })
  })

  describe('WhatsApp API payload format', () => {
    it('should include required WhatsApp API fields', () => {
      const result = buildMessagePayloads('Test', '919876543210', 'en', emptyConfig)
      const payload = result.payloads[0]
      expect(payload.messaging_product).toBe('whatsapp')
      expect(payload.recipient_type).toBe('individual')
      expect(payload.to).toBe('919876543210')
    })
  })
})
