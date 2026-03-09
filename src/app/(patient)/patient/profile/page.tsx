"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import useSWR from "swr"
import { createBrowserClient } from "@/lib/supabase/client"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  User,
  Phone,
  Mail,
  MapPin,
  Heart,
  AlertTriangle,
  Building2,
  Loader2,
  Save,
  Calendar,
  Droplets,
} from "lucide-react"
import type { SessionUser } from "@/types/auth"

export default function PatientProfilePage() {
  const { data: session } = useSession()
  const user = session?.user as SessionUser | undefined
  const phone = user?.patientPhone

  const supabase = createBrowserClient()

  const { data: patient, isLoading, mutate } = useSWR(
    phone ? `patient-profile-${phone}` : null,
    async () => {
      const { data } = await supabase
        .from("patients")
        .select("*")
        .eq("phone", phone!)
        .limit(1)
        .single()
      return data
    },
    { revalidateOnFocus: false }
  )

  // Fetch hospitals visited
  const { data: hospitals } = useSWR(
    phone ? `patient-hospitals-${phone}` : null,
    async () => {
      const { data: appts } = await supabase
        .from("appointments")
        .select("tenant_id")
        .eq("patient_phone", phone!)

      const tenantIds = [...new Set((appts || []).map((a) => a.tenant_id).filter(Boolean))]
      if (tenantIds.length === 0) return []

      const { data: tenants } = await supabase
        .from("tenants")
        .select("tenant_id, hospital_name, city")
        .in("tenant_id", tenantIds)

      return tenants || []
    },
    { revalidateOnFocus: false }
  )

  const [email, setEmail] = useState("")
  const [address, setAddress] = useState("")
  const [dob, setDob] = useState("")
  const [bloodGroup, setBloodGroup] = useState("")
  const [emergencyContact, setEmergencyContact] = useState("")
  const [allergies, setAllergies] = useState("")
  const [chronicDiseases, setChronicDiseases] = useState("")
  const [saving, setSaving] = useState(false)

  // Initialize form when patient data loads
  useEffect(() => {
    if (patient) {
      setEmail(patient.email || "")
      setAddress(patient.address || "")
      setDob(patient.date_of_birth || "")
      setBloodGroup(patient.blood_group || "")
      setEmergencyContact(patient.emergency_contact || "")
      setAllergies(patient.allergies || "")
      setChronicDiseases(patient.chronic_diseases || "")
    }
  }, [patient])

  const handleSave = async () => {
    if (!phone) return
    setSaving(true)

    try {
      const { error } = await supabase
        .from("patients")
        .update({
          email: email || null,
          address: address || null,
          date_of_birth: dob || null,
          blood_group: bloodGroup || null,
          emergency_contact: emergencyContact || null,
          allergies: allergies || null,
          chronic_diseases: chronicDiseases || null,
        })
        .eq("phone", phone)

      if (error) throw error

      toast.success("Profile updated successfully")
      mutate()
    } catch {
      toast.error("Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-lg font-bold">My Profile</h1>
        <p className="text-sm text-muted-foreground">View and update your personal information</p>
      </div>

      {/* Identity Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-teal-500 via-cyan-600 to-blue-700 p-5 text-white">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-xl font-bold">
                {(patient?.name || "P").charAt(0)}
              </div>
              <div>
                <p className="text-lg font-bold">{patient?.name || "Patient"}</p>
                <div className="flex items-center gap-3 mt-0.5 text-white/70 text-sm">
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" />
                    +{phone}
                  </span>
                  {patient?.gender && (
                    <span className="capitalize">{patient.gender}</span>
                  )}
                  {patient?.age && (
                    <span>{patient.age} yrs</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Editable Fields */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <Mail className="w-3 h-3" /> Email
              </Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Date of Birth
              </Label>
              <Input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <Droplets className="w-3 h-3" /> Blood Group
              </Label>
              <Select value={bloodGroup} onValueChange={setBloodGroup}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select blood group" />
                </SelectTrigger>
                <SelectContent>
                  {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                    <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <Phone className="w-3 h-3" /> Emergency Contact
              </Label>
              <Input
                type="tel"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                placeholder="Emergency contact number"
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Address
            </Label>
            <Textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Your address"
              rows={2}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-500" /> Allergies
            </Label>
            <Input
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              placeholder="Known allergies (e.g., Penicillin, Sulfa drugs)"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              <Heart className="w-3 h-3 text-red-500" /> Chronic Conditions
            </Label>
            <Input
              value={chronicDiseases}
              onChange={(e) => setChronicDiseases(e.target.value)}
              placeholder="Chronic conditions (e.g., Diabetes, Hypertension)"
              className="rounded-xl"
            />
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full rounded-xl gap-2">
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Changes
          </Button>
        </CardContent>
      </Card>

      {/* Hospitals Visited */}
      {hospitals && hospitals.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              Hospitals Visited
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {hospitals.map((h) => (
                <div key={h.tenant_id} className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Building2 className="w-3 h-3" />
                    {h.hospital_name}
                  </Badge>
                  {h.city && (
                    <span className="text-xs text-muted-foreground">{h.city}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
