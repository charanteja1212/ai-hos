#!/bin/bash
SB="https://pbevoxnglfbtxwgbbncp.supabase.co/rest/v1"
KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiZXZveG5nbGZidHh3Z2JibmNwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM5MjI5MywiZXhwIjoyMDg2OTY4MjkzfQ.rf2cAEDlFOmjxxeJt8r3x5y7_iOdAG3zRqOdBpU0Y7o"
H1="apikey: $KEY"
H2="Authorization: Bearer $KEY"
CT="Content-Type: application/json"
PREF="Prefer: return=representation"
TODAY="2026-02-23"
PASS=0; FAIL=0

t() {
  if echo "$3" | grep -q "$2"; then echo "  PASS: $1"; PASS=$((PASS+1))
  else echo "  FAIL: $1 [got: $(echo $3 | head -c 100)]"; FAIL=$((FAIL+1)); fi
}

post() { curl -sk -X POST "$SB/$1" -H "$H1" -H "$H2" -H "$CT" -H "$PREF" -d "$2"; }
patch() { curl -sk -X PATCH "$SB/$1" -H "$H1" -H "$H2" -H "$CT" -H "$PREF" -d "$2"; }
del() { curl -sk -X DELETE "$SB/$1" -H "$H1" -H "$H2" -o /dev/null; }
count() { curl -sk "$SB/$1" -H "$H1" -H "$H2" -H "Prefer: count=exact" -I 2>/dev/null | tr -d '\r' | grep -i content-range | sed 's/.*\///'; }

echo "=== PHASE 3: TEST DATA CREATION ==="
echo ""
echo "-- Cleaning old test data --"
del "queue_entries?queue_id=like.QT*"
del "prescriptions?prescription_id=like.PRX*"
del "pharmacy_orders?order_id=like.PHX*"
del "lab_orders?order_id=like.LBX*"
del "admissions?admission_id=like.ADX*"
del "appointments?booking_id=like.BKW*"
del "appointments?booking_id=like.BKR*"
del "patients?phone=like.919900*"
echo "  Done"

echo ""
echo "-- 3.1 Create 8 Test Patients --"
NAMES_W=("WA Patient W1" "WA Patient W2" "WA Patient W3" "WA Patient W4")
PHONES_W=("9199001010" "9199001020" "9199001030" "9199001040")
AGES_W=(30 35 40 45)
GENDERS_W=("Male" "Female" "Male" "Female")

for i in 0 1 2 3; do
  R=$(post "patients" "{\"phone\":\"${PHONES_W[$i]}\",\"name\":\"${NAMES_W[$i]}\",\"age\":${AGES_W[$i]},\"gender\":\"${GENDERS_W[$i]}\",\"tenant_id\":\"T001\"}")
  t "Patient W$((i+1)) created" "${PHONES_W[$i]}" "$R"
done

NAMES_R=("Walkin Patient R1" "Walkin Patient R2" "Walkin Patient R3" "Walkin Patient R4")
PHONES_R=("9199002010" "9199002020" "9199002030" "9199002040")
AGES_R=(33 36 39 42)
GENDERS_R=("Male" "Female" "Male" "Female")

for i in 0 1 2 3; do
  R=$(post "patients" "{\"phone\":\"${PHONES_R[$i]}\",\"name\":\"${NAMES_R[$i]}\",\"age\":${AGES_R[$i]},\"gender\":\"${GENDERS_R[$i]}\",\"tenant_id\":\"T001\"}")
  t "Patient R$((i+1)) created" "${PHONES_R[$i]}" "$R"
done

echo ""
echo "-- 3.2 WhatsApp Bookings (W1-W4) --"
DOC_IDS=("DOC001" "DOC002" "DOC003" "DOC004")
DOC_NAMES=("Dr. Rajesh sharma" "Dr. Priya Patel" "Dr. Ananya Reddy" "Dr. Vikram Singh")
SPECS=("Cardiology" "Orthopedics" "Dermatology" "General Medicine")
TIMES=("10:30" "11:00" "11:30" "12:00")

for i in 0 1 2 3; do
  R=$(post "appointments" "{\"booking_id\":\"BKW00$((i+1))\",\"patient_phone\":\"${PHONES_W[$i]}\",\"patient_name\":\"${NAMES_W[$i]}\",\"doctor_id\":\"${DOC_IDS[$i]}\",\"doctor_name\":\"${DOC_NAMES[$i]}\",\"specialty\":\"${SPECS[$i]}\",\"date\":\"$TODAY\",\"time\":\"${TIMES[$i]}\",\"status\":\"confirmed\",\"payment_status\":\"paid\",\"source\":\"whatsapp\",\"check_in_status\":\"pending\",\"tenant_id\":\"T001\"}")
  t "W$((i+1)) booked (${SPECS[$i]})" "BKW00$((i+1))" "$R"
done

echo ""
echo "-- 3.3 Walk-in Bookings (R1-R4) with Queue --"
RDOC_IDS=("DOC001" "DOC005" "DOC006" "DOC007")
RDOC_NAMES=("Dr. Rajesh sharma" "Dr. Meera Krishnan" "Dr. Arjun Nair" "Dr. Sonia Gupta")
RSPECS=("Cardiology" "Pediatrics" "ENT" "Gynecology")
RTIMES=("10:50" "11:10" "11:30" "12:00")
PRIORITIES=(0 0 1 0)
CHECKTIMES=("05:20" "05:40" "06:00" "06:30")

for i in 0 1 2 3; do
  R=$(post "appointments" "{\"booking_id\":\"BKR00$((i+1))\",\"patient_phone\":\"${PHONES_R[$i]}\",\"patient_name\":\"${NAMES_R[$i]}\",\"doctor_id\":\"${RDOC_IDS[$i]}\",\"doctor_name\":\"${RDOC_NAMES[$i]}\",\"specialty\":\"${RSPECS[$i]}\",\"date\":\"$TODAY\",\"time\":\"${RTIMES[$i]}\",\"status\":\"confirmed\",\"payment_status\":\"paid\",\"source\":\"walk-in\",\"check_in_status\":\"checked_in\",\"tenant_id\":\"T001\"}")
  t "R$((i+1)) booked (${RSPECS[$i]})" "BKR00$((i+1))" "$R"

  R=$(post "queue_entries" "{\"queue_id\":\"QT00$((i+1))\",\"tenant_id\":\"T001\",\"booking_id\":\"BKR00$((i+1))\",\"patient_phone\":\"${PHONES_R[$i]}\",\"patient_name\":\"${NAMES_R[$i]}\",\"doctor_id\":\"${RDOC_IDS[$i]}\",\"doctor_name\":\"${RDOC_NAMES[$i]}\",\"queue_number\":$((i+1)),\"status\":\"waiting\",\"check_in_time\":\"2026-02-23T${CHECKTIMES[$i]}:00Z\",\"walk_in\":true,\"priority\":${PRIORITIES[$i]},\"date\":\"$TODAY\"}")
  t "R$((i+1)) queue entry" "QT00$((i+1))" "$R"
done

echo ""
echo "-- 3.4 Check-in WhatsApp patients (W1, W2) --"
R=$(patch "appointments?booking_id=eq.BKW001" "{\"check_in_status\":\"checked_in\",\"arrival_time\":\"2026-02-23T05:00:00Z\"}")
t "W1 checked in" "checked_in" "$R"
R=$(post "queue_entries" "{\"queue_id\":\"QT005\",\"tenant_id\":\"T001\",\"booking_id\":\"BKW001\",\"patient_phone\":\"9199001010\",\"patient_name\":\"WA Patient W1\",\"doctor_id\":\"DOC001\",\"doctor_name\":\"Dr. Rajesh sharma\",\"queue_number\":2,\"status\":\"waiting\",\"check_in_time\":\"2026-02-23T05:00:00Z\",\"walk_in\":false,\"priority\":0,\"date\":\"$TODAY\"}")
t "W1 queue entry" "QT005" "$R"

R=$(patch "appointments?booking_id=eq.BKW002" "{\"check_in_status\":\"checked_in\",\"arrival_time\":\"2026-02-23T05:30:00Z\"}")
t "W2 checked in" "checked_in" "$R"
R=$(post "queue_entries" "{\"queue_id\":\"QT006\",\"tenant_id\":\"T001\",\"booking_id\":\"BKW002\",\"patient_phone\":\"9199001020\",\"patient_name\":\"WA Patient W2\",\"doctor_id\":\"DOC002\",\"doctor_name\":\"Dr. Priya Patel\",\"queue_number\":1,\"status\":\"waiting\",\"check_in_time\":\"2026-02-23T05:30:00Z\",\"walk_in\":false,\"priority\":0,\"date\":\"$TODAY\"}")
t "W2 queue entry" "QT006" "$R"

echo ""
echo "-- 3.5 Verify Data Counts --"
PC=$(count "patients?phone=like.919900*&select=count")
t "8 test patients" "8" "$PC"
AC=$(count "appointments?booking_id=like.BK%25&date=eq.$TODAY&select=count")
t "8 appointments" "8" "$AC"
QC=$(count "queue_entries?queue_id=like.QT*&select=count")
t "6 queue entries" "6" "$QC"

echo ""
echo "=== PHASE 3 RESULTS: $PASS passed, $FAIL failed ==="
