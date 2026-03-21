-- Phase 1: Fix doctors and clients anon policies
DROP POLICY IF EXISTS anon_read_doctors ON doctors;
DROP POLICY IF EXISTS anon_insert_doctors ON doctors;
DROP POLICY IF EXISTS anon_update_doctors ON doctors;
DROP POLICY IF EXISTS anon_delete_doctors ON doctors;
DROP POLICY IF EXISTS anon_select_doctors ON doctors;

CREATE POLICY auth_select_doctors ON doctors FOR SELECT TO authenticated USING (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id'));
CREATE POLICY auth_insert_doctors ON doctors FOR INSERT TO authenticated WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id'));
CREATE POLICY auth_update_doctors ON doctors FOR UPDATE TO authenticated USING (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id'));
CREATE POLICY auth_delete_doctors ON doctors FOR DELETE TO authenticated USING (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id'));

DROP POLICY IF EXISTS anon_read_clients ON clients;
DROP POLICY IF EXISTS anon_insert_clients ON clients;
DROP POLICY IF EXISTS anon_update_clients ON clients;
DROP POLICY IF EXISTS anon_delete_clients ON clients;

CREATE POLICY auth_select_clients ON clients FOR SELECT TO authenticated USING (true);
CREATE POLICY auth_insert_clients ON clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY auth_update_clients ON clients FOR UPDATE TO authenticated USING (true);
CREATE POLICY auth_delete_clients ON clients FOR DELETE TO authenticated USING (true);

-- Phase 2: Add limited anon READ-ONLY for public pages (queue display, wa/book, rx)
CREATE POLICY anon_readonly_tenants ON tenants FOR SELECT TO anon USING (true);
CREATE POLICY anon_readonly_doctors ON doctors FOR SELECT TO anon USING (true);
CREATE POLICY anon_readonly_clients ON clients FOR SELECT TO anon USING (true);
CREATE POLICY anon_readonly_queue ON queue_entries FOR SELECT TO anon USING (true);
CREATE POLICY anon_readonly_appointments ON appointments FOR SELECT TO anon USING (true);
CREATE POLICY anon_readonly_prescriptions ON prescriptions FOR SELECT TO anon USING (true);
CREATE POLICY anon_readonly_patients ON patients FOR SELECT TO anon USING (true);
CREATE POLICY anon_readonly_doctor_schedules ON doctor_schedules FOR SELECT TO anon USING (true);
CREATE POLICY anon_readonly_date_overrides ON date_overrides FOR SELECT TO anon USING (true);
CREATE POLICY anon_readonly_slot_locks ON slot_locks FOR SELECT TO anon USING (true);
CREATE POLICY anon_readonly_wa_phone_routing ON wa_phone_routing FOR SELECT TO anon USING (true);
CREATE POLICY anon_readonly_client_configs ON client_configs FOR SELECT TO anon USING (true);
CREATE POLICY anon_readonly_patient_otps ON patient_otps FOR SELECT TO anon USING (true);

-- Phase 3: Allow anon INSERT for public-facing features
CREATE POLICY anon_insert_patient_otps ON patient_otps FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_insert_wa_consent ON wa_consent FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_insert_slot_locks ON slot_locks FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_insert_feedback ON feedback FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_insert_appointments ON appointments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_insert_queue ON queue_entries FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_insert_patients ON patients FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_patients ON patients FOR UPDATE TO anon USING (true);
CREATE POLICY anon_update_appointments ON appointments FOR UPDATE TO anon USING (true);
