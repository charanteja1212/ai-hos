"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useBranch } from "@/components/providers/branch-context"
import { toast } from "sonner"
import { createBrowserClient } from "@/lib/supabase/client"
import { formatDate } from "@/lib/utils/date"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Edit,
  Users,
  Phone,
  Calendar,
  Pill,
  TestTube,
  FileText,
  Loader2,
  Save,
  Stethoscope,
  Clock,
  AlertTriangle,
  Heart,
  Activity,
} from "lucide-react"
import { motion } from "framer-motion"
import { SectionHeader } from "@/components/shared/section-header"
import { SearchBar } from "@/components/shared/search-bar"
import { PremiumDialog } from "@/components/shared/premium-dialog"
import { StatCard } from "@/components/reception/stat-card"

import { useDebounce } from "@/hooks/use-debounce"
import type { Patient, Appointment, Prescription, LabOrder } from "@/types/database"

export default function PatientsPage() {
  const { activeTenantId: tenantId } = useBranch()

  const PAGE_SIZE = 50
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const debouncedSearch = useDebounce(searchQuery, 350)
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)

  // Patient detail data
  const [patientAppointments, setPatientAppointments] = useState<Appointment[]>([])
  const [patientPrescriptions, setPatientPrescriptions] = useState<Prescription[]>([])
  const [patientLabOrders, setPatientLabOrders] = useState<LabOrder[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  // Edit form
  const [editName, setEditName] = useState("")
  const [editAge, setEditAge] = useState("")
  const [editGender, setEditGender] = useState("")
  const [editBloodGroup, setEditBloodGroup] = useState("")
  const [editAllergies, setEditAllergies] = useState("")
  const [editChronicDiseases, setEditChronicDiseases] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editAddress, setEditAddress] = useState("")
  const [editEmergencyContact, setEditEmergencyContact] = useState("")

  const fetchPatients = useCallback(async () => {
    const supabase = createBrowserClient()
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase
      .from("patients")
      .select("*", { count: "exact" })
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim()
      const isPhone = q.replace(/\D/g, "").length >= 7
      if (isPhone) {
        query = query.like("phone", `%${q.replace(/\D/g, "")}%`)
      } else {
        query = query.ilike("name", `%${q}%`)
      }
    }

    const { data, count } = await query.range(from, to)
    if (data) setPatients(data as Patient[])
    setTotalCount(count || 0)
    setLoading(false)
  }, [tenantId, page, debouncedSearch])

  useEffect(() => { fetchPatients() }, [fetchPatients])
  useEffect(() => { setPage(0) }, [debouncedSearch])

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const stats = useMemo(() => {
    const withAllergies = patients.filter((p) => p.allergies).length
    const withChronic = patients.filter((p) => p.chronic_diseases).length
    return { total: totalCount, withAllergies, withChronic }
  }, [patients, totalCount])

  const openPatientDetail = useCallback(async (patient: Patient) => {
    setSelectedPatient(patient)
    setEditMode(false)
    setDetailLoading(true)

    // Populate edit fields
    setEditName(patient.name || "")
    setEditAge(String(patient.age || ""))
    setEditGender(patient.gender || "")
    setEditBloodGroup(patient.blood_group || "")
    setEditAllergies(patient.allergies || "")
    setEditChronicDiseases(patient.chronic_diseases || "")
    setEditEmail(patient.email || "")
    setEditAddress(patient.address || "")
    setEditEmergencyContact(patient.emergency_contact || "")

    const supabase = createBrowserClient()
    const [apptRes, rxRes, labRes] = await Promise.all([
      supabase
        .from("appointments")
        .select("*")
        .eq("patient_phone", patient.phone)
        .eq("tenant_id", tenantId)
        .order("date", { ascending: false })
        .limit(20),
      supabase
        .from("prescriptions")
        .select("*")
        .eq("patient_phone", patient.phone)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("lab_orders")
        .select("*")
        .eq("patient_phone", patient.phone)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(20),
    ])

    setPatientAppointments((apptRes.data || []) as Appointment[])
    setPatientPrescriptions((rxRes.data || []) as Prescription[])
    setPatientLabOrders((labRes.data || []) as LabOrder[])
    setDetailLoading(false)
  }, [tenantId])

  const handleSavePatient = useCallback(async () => {
    if (!selectedPatient) return
    setSaving(true)
    const supabase = createBrowserClient()

    try {
      const { error } = await supabase
        .from("patients")
        .update({
          name: editName,
          age: editAge ? parseInt(editAge) : null,
          gender: editGender || null,
          blood_group: editBloodGroup || null,
          allergies: editAllergies || null,
          chronic_diseases: editChronicDiseases || null,
          email: editEmail || null,
          address: editAddress || null,
          emergency_contact: editEmergencyContact || null,
        })
        .eq("phone", selectedPatient.phone)
        .eq("tenant_id", tenantId)

      if (error) throw error
      toast.success("Patient updated")
      setEditMode(false)
      fetchPatients()
    } catch (err) {
      console.error("[patients] Failed to update patient:", err)
      toast.error("Failed to update patient")
    } finally {
      setSaving(false)
    }
  }, [selectedPatient, editName, editAge, editGender, editBloodGroup, editAllergies, editChronicDiseases, editEmail, editAddress, editEmergencyContact, fetchPatients, tenantId])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 rounded-2xl" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-12 rounded-xl" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        variant="glass"
        icon={<Users className="w-6 h-6" />}
        gradient="gradient-purple"
        title="Patient CRM"
        subtitle="Manage patient records, history, and demographics"
        badge={<Badge variant="secondary" className="text-xs">{stats.total}</Badge>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger-children">
        <StatCard label="Total Patients" value={stats.total} gradient="gradient-purple" icon={<Users className="w-10 h-10" />} index={0} />
        <StatCard label="With Allergies" value={stats.withAllergies} gradient="gradient-red" icon={<AlertTriangle className="w-10 h-10" />} index={1} />
        <StatCard label="Chronic Conditions" value={stats.withChronic} gradient="gradient-orange" icon={<Heart className="w-10 h-10" />} index={2} />
      </div>

      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search by name, phone, or email..."
      />

      <div className="table-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Age / Gender</TableHead>
              <TableHead>Blood Group</TableHead>
              <TableHead>Allergies</TableHead>
              <TableHead>Registered</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {patients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                    <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  </motion.div>
                  No patients found
                </TableCell>
              </TableRow>
            ) : (
              patients.map((p, idx) => (
                <motion.tr
                  key={p.phone}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className="cursor-pointer hover:bg-accent/30 border-b transition-colors duration-150"
                  onClick={() => openPatientDetail(p)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl gradient-purple flex items-center justify-center text-white font-bold text-sm">
                        {(p.name || "?")[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{p.name}</p>
                        {p.chronic_diseases && (
                          <p className="text-xs text-orange-500">{p.chronic_diseases}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Phone className="w-3 h-3 text-muted-foreground" />
                      {p.phone}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.age ? `${p.age}y` : "\u2014"} / {p.gender || "\u2014"}
                  </TableCell>
                  <TableCell>
                    {p.blood_group ? (
                      <Badge variant="outline">{p.blood_group}</Badge>
                    ) : "\u2014"}
                  </TableCell>
                  <TableCell>
                    {p.allergies ? (
                      <div className="flex items-center gap-1 text-xs text-destructive">
                        <AlertTriangle className="w-3 h-3" />{p.allergies}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">None</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.created_at ? formatDate(p.created_at.split("T")[0]) : "\u2014"}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openPatientDetail(p) }}>
                      <Edit className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </motion.tr>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount} patients
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Patient Detail Dialog */}
      <PremiumDialog
        open={!!selectedPatient}
        onOpenChange={() => setSelectedPatient(null)}
        title={selectedPatient?.name || "Patient"}
        subtitle={selectedPatient?.phone}
        icon={<Users className="w-5 h-5" />}
        gradient="gradient-blue"
        maxWidth="sm:max-w-2xl"
      >
        {selectedPatient && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button
                variant={editMode ? "default" : "outline"}
                size="sm"
                onClick={() => setEditMode(!editMode)}
              >
                <Edit className="w-4 h-4 mr-1" />
                {editMode ? "Cancel Edit" : "Edit"}
              </Button>
            </div>

            {/* Edit Mode */}
            {editMode ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 col-span-2">
                    <Label>Full Name</Label>
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Age</Label>
                    <Input type="number" value={editAge} onChange={(e) => setEditAge(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Gender</Label>
                    <Select value={editGender} onValueChange={setEditGender}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Blood Group</Label>
                    <Select value={editBloodGroup} onValueChange={setEditBloodGroup}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                          <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label>Address</Label>
                    <Input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-destructive">Allergies</Label>
                    <Input value={editAllergies} onChange={(e) => setEditAllergies(e.target.value)} placeholder="Penicillin, Sulfa drugs..." />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label>Chronic Diseases</Label>
                    <Input value={editChronicDiseases} onChange={(e) => setEditChronicDiseases(e.target.value)} placeholder="Diabetes, Hypertension..." />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label>Emergency Contact</Label>
                    <Input value={editEmergencyContact} onChange={(e) => setEditEmergencyContact(e.target.value)} placeholder="Name \u2014 Phone" />
                  </div>
                </div>
                <Button onClick={handleSavePatient} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Changes
                </Button>
              </div>
            ) : (
              <>
                {/* Patient Info Card */}
                <div className="rounded-xl gradient-blue p-4 text-white">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-lg font-bold">
                      {(selectedPatient.name || "P")[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{selectedPatient.name}</p>
                      <div className="flex items-center gap-3 text-sm text-white/70 mt-0.5">
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{selectedPatient.phone}</span>
                        {selectedPatient.age && <span>{selectedPatient.age}y {selectedPatient.gender || ""}</span>}
                        {selectedPatient.blood_group && <Badge variant="outline" className="text-white/90 border-white/30 text-[10px]">{selectedPatient.blood_group}</Badge>}
                      </div>
                    </div>
                  </div>
                  {selectedPatient.allergies && (
                    <div className="flex items-center gap-2 mt-3 text-sm bg-white/10 rounded-lg px-3 py-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-300" />
                      Allergies: {selectedPatient.allergies}
                    </div>
                  )}
                  {selectedPatient.chronic_diseases && (
                    <div className="flex items-center gap-2 mt-2 text-sm bg-white/10 rounded-lg px-3 py-1.5">
                      <Activity className="w-4 h-4 text-orange-300" />
                      Chronic: {selectedPatient.chronic_diseases}
                    </div>
                  )}
                </div>

                {detailLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 rounded-xl" />
                    ))}
                  </div>
                ) : (
                  <>
                    {/* Appointments */}
                    <Card className="border-l-4 border-l-primary/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md gradient-blue flex items-center justify-center text-white"><Calendar className="w-3 h-3" /></div>
                          Appointments ({patientAppointments.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {patientAppointments.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No appointments</p>
                        ) : (
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {patientAppointments.map((a) => (
                              <div key={a.booking_id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                                <div className="flex items-center gap-2 text-xs">
                                  <Stethoscope className="w-3 h-3 text-muted-foreground" />
                                  <span>{a.doctor_name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">{formatDate(a.date)} {a.time}</span>
                                  <Badge variant="secondary" className="text-[10px]">{a.status}</Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Prescriptions */}
                    <Card className="border-l-4 border-l-purple-500/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md gradient-purple flex items-center justify-center text-white"><FileText className="w-3 h-3" /></div>
                          Prescriptions ({patientPrescriptions.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {patientPrescriptions.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No prescriptions</p>
                        ) : (
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {patientPrescriptions.map((rx) => (
                              <div key={rx.prescription_id} className="py-1.5 border-b border-border last:border-0">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 text-xs">
                                    <Clock className="w-3 h-3 text-muted-foreground" />
                                    {rx.created_at ? formatDate(rx.created_at.split("T")[0]) : "\u2014"}
                                    <span className="text-muted-foreground">Dr. {rx.doctor_name}</span>
                                  </div>
                                </div>
                                {rx.diagnosis && <p className="text-xs font-medium mt-0.5">{rx.diagnosis}</p>}
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {rx.items?.slice(0, 4).map((item, i) => (
                                    <Badge key={i} variant="outline" className="text-[10px]">
                                      <Pill className="w-2 h-2 mr-0.5" />{item.medicine_name}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Lab Orders */}
                    <Card className="border-l-4 border-l-teal-500/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md gradient-teal flex items-center justify-center text-white"><TestTube className="w-3 h-3" /></div>
                          Lab Orders ({patientLabOrders.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {patientLabOrders.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No lab orders</p>
                        ) : (
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {patientLabOrders.map((lab) => (
                              <div key={lab.order_id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                                <div className="flex flex-wrap gap-1">
                                  {lab.tests?.map((t, i) => (
                                    <Badge key={i} variant="outline" className="text-[10px]">{t.test_name}</Badge>
                                  ))}
                                </div>
                                <Badge variant="secondary" className="text-[10px]">{lab.status}</Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </PremiumDialog>
    </div>
  )
}
