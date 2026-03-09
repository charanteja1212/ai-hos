#!/bin/bash
SB="https://pbevoxnglfbtxwgbbncp.supabase.co/rest/v1"
KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiZXZveG5nbGZidHh3Z2JibmNwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM5MjI5MywiZXhwIjoyMDg2OTY4MjkzfQ.rf2cAEDlFOmjxxeJt8r3x5y7_iOdAG3zRqOdBpU0Y7o"
H1="apikey: $KEY"
H2="Authorization: Bearer $KEY"
CT="Content-Type: application/json"
PREF="Prefer: return=representation"
TODAY="2026-02-23"
PASS=0; FAIL=0; ISSUES=""

t() {
  if echo "$3" | grep -q "$2"; then echo "  PASS: $1"; PASS=$((PASS+1))
  else echo "  FAIL: $1 [expected=$2]"; FAIL=$((FAIL+1)); ISSUES="$ISSUES|$1"; fi
}

post() { curl -sk -X POST "$SB/$1" -H "$H1" -H "$H2" -H "$CT" -H "$PREF" -d "$2"; }
patch() { curl -sk -X PATCH "$SB/$1" -H "$H1" -H "$H2" -H "$CT" -H "$PREF" -d "$2"; }
get() { curl -sk "$SB/$1" -H "$H1" -H "$H2"; }

echo "============================================"
echo "  PHASE 4: RECEPTION WORKFLOW"
echo "============================================"
echo ""
echo "-- 4.1 Patient Search --"
R=$(get "patients?phone=eq.9199001010&select=name,phone,age")
t "Search by phone" "WA Patient W1" "$R"
R=$(get "patients?name=ilike.%25Walkin%25&select=name&limit=4")
t "Search by name" "Walkin Patient" "$R"

echo ""
echo "-- 4.2 Queue Board Data --"
R=$(get "queue_entries?tenant_id=eq.T001&date=eq.$TODAY&select=*&order=priority.desc,queue_number.asc")
t "Queue entries loaded" "queue_id" "$R"

echo ""
echo "-- 4.3 Priority Queue --"
R=$(get "queue_entries?queue_id=eq.QT003&select=priority")
t "R3 is urgent priority=1" "1" "$R"

echo ""
echo "-- 4.4 Start Consultation via Queue --"
R=$(patch "queue_entries?queue_id=eq.QT001" "{\"status\":\"in_consultation\",\"consultation_start\":\"2026-02-23T05:30:00Z\"}")
t "R1 -> in_consultation" "in_consultation" "$R"

echo ""
echo "-- 4.5 Cancel from Queue --"
R=$(patch "queue_entries?queue_id=eq.QT004" "{\"status\":\"cancelled\"}")
t "R4 queue cancelled" "cancelled" "$R"

echo ""
echo "-- 4.6 Duplicate Patient Prevention --"
R=$(post "patients" "{\"phone\":\"9199001010\",\"name\":\"Duplicate\",\"age\":30,\"gender\":\"Male\",\"tenant_id\":\"T001\"}")
HAS_ERR=$(echo "$R" | grep -c "duplicate\|23505\|conflict\|already")
if [ "$HAS_ERR" -gt 0 ]; then t "Duplicate blocked" "yes" "yes"
else t "Duplicate blocked" "error_expected" "$R"; fi

echo ""
echo "============================================"
echo "  PHASE 5: DOCTOR WORKFLOW"
echo "============================================"
echo ""
echo "-- 5.1 Doctor Queue --"
R=$(get "queue_entries?doctor_id=eq.DOC001&date=eq.$TODAY&select=queue_id,patient_name,status")
t "DOC001 queue visible" "DOC001" "$(get 'queue_entries?doctor_id=eq.DOC001&date=eq.2026-02-23&select=doctor_id&limit=1')"

echo ""
echo "-- 5.2 Create Prescription --"
R=$(post "prescriptions" "{\"prescription_id\":\"PRX001\",\"booking_id\":\"BKR001\",\"patient_phone\":\"9199002010\",\"doctor_id\":\"DOC001\",\"doctor_name\":\"Dr. Rajesh sharma\",\"type\":\"medicine\",\"items\":[{\"medicine_name\":\"Paracetamol 500mg\",\"dosage\":\"1 tablet\",\"frequency\":\"3x daily\",\"duration\":\"5 days\",\"quantity\":15},{\"medicine_name\":\"Amoxicillin 250mg\",\"dosage\":\"1 cap\",\"frequency\":\"2x daily\",\"duration\":\"7 days\",\"quantity\":14},{\"medicine_name\":\"Cetirizine 10mg\",\"dosage\":\"1 tablet\",\"frequency\":\"once daily\",\"duration\":\"3 days\",\"quantity\":3}],\"diagnosis\":\"Upper Respiratory Infection\",\"symptoms\":\"Cough, fever\",\"vitals\":{\"bp\":\"120/80\",\"pulse\":\"72\",\"temperature\":\"98.6\",\"spo2\":\"98\",\"weight\":\"70\"},\"follow_up_date\":\"2026-02-28\",\"tenant_id\":\"T001\"}")
t "Prescription PRX001 created" "PRX001" "$R"

echo ""
echo "-- 5.3 Verify JSONB --"
R=$(get "prescriptions?prescription_id=eq.PRX001&select=items")
MCOUNT=$(echo "$R" | grep -o "medicine_name" | wc -l)
t "3 medicines stored" "3" "$MCOUNT"

echo ""
echo "-- 5.4 Pharmacy Order --"
R=$(post "pharmacy_orders" "{\"order_id\":\"PHX001\",\"tenant_id\":\"T001\",\"prescription_id\":\"PRX001\",\"patient_phone\":\"9199002010\",\"patient_name\":\"Walkin Patient R1\",\"doctor_name\":\"Dr. Rajesh sharma\",\"items\":[{\"medicine_name\":\"Paracetamol 500mg\",\"dosage\":\"1 tablet\",\"frequency\":\"3x daily\",\"duration\":\"5 days\",\"quantity\":15}],\"total_amount\":350,\"status\":\"pending\"}")
t "Pharmacy order PHX001" "PHX001" "$R"

echo ""
echo "-- 5.5 Lab Order --"
R=$(post "lab_orders" "{\"order_id\":\"LBX001\",\"tenant_id\":\"T001\",\"patient_phone\":\"9199002010\",\"patient_name\":\"Walkin Patient R1\",\"doctor_id\":\"DOC001\",\"doctor_name\":\"Dr. Rajesh sharma\",\"booking_id\":\"BKR001\",\"tests\":[{\"test_id\":\"LT001\",\"test_name\":\"CBC\",\"status\":\"ordered\"},{\"test_id\":\"LT002\",\"test_name\":\"Chest X-Ray\",\"status\":\"ordered\"}],\"status\":\"ordered\",\"results\":{}}")
t "Lab order LBX001" "LBX001" "$R"

echo ""
echo "-- 5.6 Complete Consultation --"
R=$(patch "queue_entries?queue_id=eq.QT001" "{\"status\":\"completed\",\"consultation_end\":\"2026-02-23T06:00:00Z\"}")
t "R1 consultation completed" "completed" "$R"
R=$(patch "appointments?booking_id=eq.BKR001" "{\"status\":\"completed\"}")
t "R1 appointment completed" "completed" "$R"

echo ""
echo "-- 5.7 Second Consultation W1 --"
R=$(patch "queue_entries?queue_id=eq.QT005" "{\"status\":\"in_consultation\",\"consultation_start\":\"2026-02-23T06:05:00Z\"}")
t "W1 consultation started" "in_consultation" "$R"
R=$(post "prescriptions" "{\"prescription_id\":\"PRX002\",\"booking_id\":\"BKW001\",\"patient_phone\":\"9199001010\",\"doctor_id\":\"DOC001\",\"doctor_name\":\"Dr. Rajesh sharma\",\"type\":\"medicine\",\"items\":[{\"medicine_name\":\"Atorvastatin 10mg\",\"dosage\":\"1 tab\",\"frequency\":\"once nightly\",\"duration\":\"30 days\",\"quantity\":30}],\"diagnosis\":\"Hyperlipidemia\",\"tenant_id\":\"T001\"}")
t "W1 prescription PRX002" "PRX002" "$R"
R=$(post "pharmacy_orders" "{\"order_id\":\"PHX002\",\"tenant_id\":\"T001\",\"prescription_id\":\"PRX002\",\"patient_phone\":\"9199001010\",\"patient_name\":\"WA Patient W1\",\"doctor_name\":\"Dr. Rajesh sharma\",\"items\":[{\"medicine_name\":\"Atorvastatin 10mg\",\"dosage\":\"1 tab\",\"frequency\":\"once nightly\",\"duration\":\"30 days\"}],\"total_amount\":180,\"status\":\"pending\"}")
t "W1 pharmacy order PHX002" "PHX002" "$R"
R=$(patch "queue_entries?queue_id=eq.QT005" "{\"status\":\"completed\",\"consultation_end\":\"2026-02-23T06:30:00Z\"}")
t "W1 consultation done" "completed" "$R"

echo ""
echo "============================================"
echo "  PHASE 6: LAB WORKFLOW"
echo "============================================"
echo ""
echo "-- 6.1 Order Visible --"
R=$(get "lab_orders?order_id=eq.LBX001&select=status,tests")
t "Lab order visible" "ordered" "$R"

echo ""
echo "-- 6.2 Sample Collection --"
R=$(patch "lab_orders?order_id=eq.LBX001" "{\"status\":\"sample_collected\",\"sample_collected_at\":\"2026-02-23T06:15:00Z\"}")
t "Sample collected" "sample_collected" "$R"

echo ""
echo "-- 6.3 Processing --"
R=$(patch "lab_orders?order_id=eq.LBX001" "{\"status\":\"processing\"}")
t "Lab processing" "processing" "$R"

echo ""
echo "-- 6.4 Results Entry --"
R=$(patch "lab_orders?order_id=eq.LBX001" "{\"status\":\"completed\",\"results\":{\"CBC\":{\"hemoglobin\":\"14.2 g/dL\",\"wbc\":\"7500\",\"platelets\":\"250000\"},\"Chest X-Ray\":{\"findings\":\"Normal\"}},\"results_uploaded_at\":\"2026-02-23T07:00:00Z\"}")
t "Lab completed with results" "completed" "$R"

echo ""
echo "-- 6.5 Verify Results --"
R=$(get "lab_orders?order_id=eq.LBX001&select=results")
t "CBC results stored" "hemoglobin" "$R"
t "X-Ray results stored" "Normal" "$R"

echo ""
echo "============================================"
echo "  PHASE 7: PHARMACY WORKFLOW"
echo "============================================"
echo ""
echo "-- 7.1 Pending Orders --"
R=$(get "pharmacy_orders?tenant_id=eq.T001&select=order_id,status")
t "Orders visible" "PHX" "$R"

echo ""
echo "-- 7.2 PHX001: pending -> preparing -> ready -> dispensed --"
R=$(patch "pharmacy_orders?order_id=eq.PHX001" "{\"status\":\"preparing\"}")
t "PHX001 preparing" "preparing" "$R"
R=$(patch "pharmacy_orders?order_id=eq.PHX001" "{\"status\":\"ready\"}")
t "PHX001 ready" "ready" "$R"
R=$(patch "pharmacy_orders?order_id=eq.PHX001" "{\"status\":\"dispensed\",\"dispensed_at\":\"2026-02-23T07:30:00Z\",\"prepared_by\":\"Pharmacist\"}")
t "PHX001 dispensed" "dispensed" "$R"

echo ""
echo "-- 7.3 PHX002 Pipeline --"
R=$(patch "pharmacy_orders?order_id=eq.PHX002" "{\"status\":\"preparing\"}")
t "PHX002 preparing" "preparing" "$R"
R=$(patch "pharmacy_orders?order_id=eq.PHX002" "{\"status\":\"ready\"}")
t "PHX002 ready" "ready" "$R"
R=$(patch "pharmacy_orders?order_id=eq.PHX002" "{\"status\":\"dispensed\",\"dispensed_at\":\"2026-02-23T08:00:00Z\"}")
t "PHX002 dispensed" "dispensed" "$R"

echo ""
echo "-- 7.4 Verify Final States --"
R=$(get "pharmacy_orders?order_id=eq.PHX001&select=status,dispensed_at")
t "PHX001 final: dispensed" "dispensed" "$R"
R=$(get "pharmacy_orders?order_id=eq.PHX002&select=status")
t "PHX002 final: dispensed" "dispensed" "$R"

echo ""
echo "============================================"
echo "  PHASE 8: ADMISSION WORKFLOW"
echo "============================================"
echo ""
echo "-- 8.1 Admit Patient --"
R=$(post "admissions" "{\"admission_id\":\"ADX001\",\"tenant_id\":\"T001\",\"patient_phone\":\"9199002010\",\"patient_name\":\"Walkin Patient R1\",\"doctor_id\":\"DOC001\",\"doctor_name\":\"Dr. Rajesh sharma\",\"ward\":\"General Ward\",\"bed_number\":\"GW-101\",\"diagnosis\":\"Severe URI\",\"admission_date\":\"$TODAY\",\"expected_discharge\":\"2026-02-26\",\"status\":\"admitted\",\"from_appointment\":\"BKR001\"}")
t "Patient admitted ADX001" "ADX001" "$R"

echo ""
echo "-- 8.2 Verify --"
R=$(get "admissions?admission_id=eq.ADX001&select=ward,bed_number,status")
t "Ward: General Ward" "General Ward" "$R"
t "Bed: GW-101" "GW-101" "$R"
t "Status: admitted" "admitted" "$R"

echo ""
echo "-- 8.3 Transfer Ward --"
R=$(patch "admissions?admission_id=eq.ADX001" "{\"ward\":\"ICU\",\"bed_number\":\"ICU-05\",\"notes\":\"Transferred to ICU\"}")
t "Transferred to ICU" "ICU" "$R"

echo ""
echo "-- 8.4 Discharge --"
R=$(patch "admissions?admission_id=eq.ADX001" "{\"status\":\"discharged\",\"actual_discharge\":\"$TODAY\",\"notes\":\"Recovered\"}")
t "Patient discharged" "discharged" "$R"

echo ""
echo "-- 8.5 Verify Discharge --"
R=$(get "admissions?admission_id=eq.ADX001&select=status,actual_discharge")
t "Final: discharged" "discharged" "$R"
t "Discharge date" "$TODAY" "$R"

echo ""
echo "============================================"
echo "  PHASES 4-8 SUMMARY"
echo "============================================"
echo "RESULTS: $PASS passed, $FAIL failed"
if [ $FAIL -gt 0 ]; then
  echo "FAILURES: $ISSUES"
fi
