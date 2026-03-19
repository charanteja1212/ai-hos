# AI-HOS Data Handling & Privacy Policy

**Version:** 1.0
**Last Updated:** 2026-03-19
**Applicable Regulations:** IT Act 2000, DISHA (Digital Information Security in Healthcare Act), SPDI Rules

---

## 1. Data Classification

| Category | Examples | Sensitivity | Retention |
|----------|----------|-------------|-----------|
| **Patient Identifiable Data (PID)** | Name, phone, email, address, age, gender | HIGH | 3 years after last visit |
| **Clinical Records** | Prescriptions, vitals, clinical notes, lab results | CRITICAL | 10 years minimum |
| **Financial Records** | Invoices, payment transactions | HIGH | 8 years (Income Tax Act) |
| **Operational Data** | Appointments, queue entries, schedules | MEDIUM | 2 years |
| **Authentication Data** | OTPs, session tokens, login attempts | LOW | 30 days |
| **Audit Logs** | Action logs, access logs | HIGH | 5 years |
| **System Data** | Rate limit counters, cache entries | LOW | 24 hours |

---

## 2. Data Collection

### What We Collect
- **Patient registration:** Name, phone number, age, gender, email (optional), address (optional)
- **Clinical data:** Vitals (BP, temperature, pulse, SpO2, weight), prescriptions, clinical notes (SOAP format), lab orders and results
- **Appointment data:** Doctor, date, time, status, booking source
- **Payment data:** Invoice amounts, payment method, transaction IDs (via Razorpay — we do NOT store card numbers)
- **Communication data:** WhatsApp message IDs (not content), OTP delivery status

### What We Do NOT Collect
- Credit/debit card numbers (handled by Razorpay PCI-DSS compliant gateway)
- Biometric data
- Aadhaar numbers (ABHA numbers are stored separately if ABDM is enabled)
- GPS location data

---

## 3. Data Storage

### Primary Database
- **Provider:** Supabase (PostgreSQL)
- **Location:** Cloud-hosted in India region
- **Encryption:** AES-256 at rest, TLS 1.2+ in transit
- **Access Control:** Row-Level Security (RLS) enforcing tenant isolation
- **Backups:** Automated daily backups with 30-day retention

### File Storage
- **Provider:** Supabase Storage
- **Types:** Patient documents, lab reports, prescriptions (PDF/images)
- **Access:** Authenticated URLs with tenant-scoped policies

### Cache & Queue
- **Provider:** Redis
- **Data:** Rate limit counters, session tokens, job queue
- **Persistence:** AOF (append-only file) for job queue data
- **Expiry:** All cache entries have TTL (max 24 hours)

---

## 4. Data Access Controls

### Multi-Tenant Isolation
Every database query is scoped by `tenant_id` (branch identifier). Row-Level Security policies prevent cross-tenant data access at the database level.

### Role-Based Access
| Role | Access Scope |
|------|-------------|
| SUPER_ADMIN | All tenants (platform management only) |
| CLIENT_ADMIN | All branches within their organization |
| BRANCH_ADMIN | Single branch — full operational access |
| DOCTOR | Own patients, own appointments, clinical records |
| RECEPTION | Patient registration, appointments, queue, billing |
| LAB_TECH | Lab orders and results for their branch |
| PHARMACIST | Pharmacy orders for their branch |
| PATIENT | Own records only (appointments, prescriptions, lab results) |

### Authentication Methods
- **Staff:** PIN-based login (rate-limited to 5 attempts per 15 minutes)
- **Admin:** Email + password (Supabase Auth)
- **Patient:** Phone OTP via WhatsApp (6-digit, 5-minute expiry, max 3 per 15 minutes)

---

## 5. Data Retention Policy

| Data Type | Active Period | Archive Period | Deletion |
|-----------|--------------|----------------|----------|
| Clinical records | Indefinite | N/A | Soft-delete only (never hard deleted) |
| Prescriptions | Indefinite | N/A | Soft-delete only |
| Lab results | Indefinite | N/A | Soft-delete only |
| Patient demographics | Until patient requests deletion | 3 years post-request | Anonymized after archive |
| Appointments | 2 years | 3 years | Anonymized |
| Invoices | 8 years | 2 years | Hard deleted |
| OTPs | 5 minutes | N/A | Hard deleted after expiry |
| Session tokens | 24 hours | N/A | Auto-expired |
| Rate limit data | 15 minutes | N/A | Auto-expired |
| Audit logs | 5 years | 2 years | Hard deleted |
| WhatsApp sessions | 24 hours | N/A | Auto-expired |

### Soft Delete Policy
Medical records use soft deletion (`deleted_at` timestamp). Records marked as deleted are:
- Excluded from normal queries
- Retained for regulatory compliance
- Restorable by authorized administrators
- Permanently purged only after retention period expires

---

## 6. Data Sharing

### Third-Party Services
| Service | Data Shared | Purpose |
|---------|------------|---------|
| Razorpay | Invoice amount, patient name, phone | Payment processing |
| WhatsApp (Meta) | Phone number, message content | Appointment notifications, OTP delivery |
| OpenAI (if enabled) | Anonymized conversation context | AI-powered chat assistance |
| Sentry (if enabled) | Error stack traces (no PII) | Error monitoring |

### ABDM Integration (Optional)
When enabled, health records may be shared via ABDM Health Information Exchange:
- Only with patient's explicit consent
- Using FHIR-compliant data format
- Time-limited access (consent defines duration)
- Audit logged

---

## 7. Security Measures

### Application Security
- Content Security Policy (CSP) headers
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options: DENY (clickjacking prevention)
- X-Content-Type-Options: nosniff
- Rate limiting on all authentication endpoints
- Input validation (Zod schemas) on all API routes
- SQL injection prevention (parameterized queries via Supabase SDK)
- XSS prevention (React auto-escaping + CSP)

### Infrastructure Security
- TLS 1.2+ for all connections
- Environment variables for secrets (never hardcoded)
- Service role key restricted to server-side only
- JWT tokens for session management (signed with dedicated secret)
- Redis authentication (when deployed with password)

### Monitoring
- Sentry for error tracking (no PII in error reports)
- Structured logging with sensitive field redaction
- Audit trail for all data modifications

---

## 8. Patient Rights

### Right to Access
Patients can view their own records through:
- Patient portal (web application)
- WhatsApp bot (prescriptions, appointments, lab results)
- Hospital reception (printed records on request)

### Right to Correction
Patients can request corrections to their demographic data through hospital reception.

### Right to Deletion
Patients may request account deletion. Upon request:
1. Demographic data is anonymized
2. Clinical records are retained (regulatory requirement) but de-identified
3. Authentication credentials are permanently deleted
4. The request is audit-logged

### Data Portability
Patients can export their records in:
- PDF format (prescriptions, lab reports)
- ABDM Health Information Exchange (if enabled)

---

## 9. Incident Response

### Data Breach Protocol
1. **Detect:** Automated monitoring alerts on unusual access patterns
2. **Contain:** Revoke affected sessions, rotate compromised keys
3. **Assess:** Determine scope of breach (which tenants, which data)
4. **Notify:** Inform affected hospitals within 24 hours
5. **Report:** File incident report with CERT-In within 72 hours (if applicable)
6. **Remediate:** Patch vulnerability, update access controls
7. **Review:** Post-incident review and policy update

---

## 10. Compliance Contacts

- **Data Protection Officer:** [Hospital's designated DPO]
- **Technical Contact:** Platform administrator
- **Regulatory Inquiries:** [Hospital's legal team]

---

*This policy is reviewed quarterly and updated as regulations evolve.*
