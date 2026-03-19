"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Cpu,
  Wifi,
  WifiOff,
  Activity,
  Plus,
  Settings,
  AlertTriangle,
  Save,
  Heart,
  Droplets,
  Thermometer,
  Weight,
  Zap,
  MonitorSmartphone,
} from "lucide-react"
import { motion } from "framer-motion"
import { Switch } from "@/components/ui/switch"
import { SectionHeader } from "@/components/shared/section-header"
import { FeatureGate } from "@/components/shared/feature-gate"

export default function IoTGatewayPage() {
  return (
    <FeatureGate feature="iot_gateway" featureName="IoT Device Gateway">
      <IoTGatewayContent />
    </FeatureGate>
  )
}

const DEVICE_TYPES = [
  {
    name: "Pulse Oximeter",
    icon: Heart,
    color: "text-rose-500",
    bg: "bg-rose-50 dark:bg-rose-900/20",
    params: "SpO2, Heart Rate",
  },
  {
    name: "Blood Pressure Monitor",
    icon: Activity,
    color: "text-cyan-600",
    bg: "bg-cyan-50 dark:bg-cyan-900/20",
    params: "Systolic, Diastolic",
  },
  {
    name: "ECG Monitor",
    icon: Zap,
    color: "text-purple-500",
    bg: "bg-purple-50 dark:bg-purple-900/20",
    params: "Heart rhythm, HR",
  },
  {
    name: "Glucometer",
    icon: Droplets,
    color: "text-amber-500",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    params: "Blood glucose",
  },
  {
    name: "Thermometer",
    icon: Thermometer,
    color: "text-orange-500",
    bg: "bg-orange-50 dark:bg-orange-900/20",
    params: "Body temperature",
  },
  {
    name: "Weight Scale",
    icon: Weight,
    color: "text-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    params: "Patient weight",
  },
]

function IoTGatewayContent() {
  const [mqttUrl, setMqttUrl] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [pollingInterval, setPollingInterval] = useState("10")
  const [gatewayEnabled, setGatewayEnabled] = useState(false)

  const handleSave = () => {
    toast.success("Gateway settings saved")
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <SectionHeader
        variant="glass"
        icon={<Cpu className="w-6 h-6" />}
        gradient="gradient-blue"
        title="IoT Device Gateway"
        subtitle="Connect and monitor medical devices"
      />

      {/* Coming Soon Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-amber-800 text-sm font-medium">
        IoT Gateway integration is coming soon. Configuration saved locally for preview purposes only.
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Devices", value: 0, icon: Cpu, color: "text-cyan-600" },
          { label: "Online", value: 0, icon: Wifi, color: "text-emerald-500" },
          { label: "Offline", value: 0, icon: WifiOff, color: "text-red-500" },
          { label: "Alerts", value: 0, icon: AlertTriangle, color: "text-amber-500" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.03 }}
          >
            <Card className="card-hover">
              <CardContent className="p-4 text-center">
                <stat.icon className={`w-5 h-5 ${stat.color} mx-auto mb-1`} />
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Gateway Configuration */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="card-hover">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg gradient-blue flex items-center justify-center text-white">
                <Settings className="w-3.5 h-3.5" />
              </div>
              Gateway Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>MQTT Broker URL</Label>
              <Input
                value={mqttUrl}
                onChange={(e) => setMqttUrl(e.target.value)}
                placeholder="mqtt://broker.hospital.local"
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label>API Key</Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter gateway API key"
                className="font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Polling Interval</Label>
                <Select value={pollingInterval} onValueChange={setPollingInterval}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 seconds</SelectItem>
                    <SelectItem value="10">10 seconds</SelectItem>
                    <SelectItem value="30">30 seconds</SelectItem>
                    <SelectItem value="60">60 seconds</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Enable Gateway</Label>
                <div className="flex items-center gap-3 h-10">
                  <Switch checked={gatewayEnabled} onCheckedChange={setGatewayEnabled} />
                  <span className="text-sm text-muted-foreground">
                    {gatewayEnabled ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>

            <Button onClick={handleSave} disabled className="w-full" variant="secondary">
              <Save className="w-4 h-4 mr-2" />
              Save Gateway Settings (Coming Soon)
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Supported Device Types */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <MonitorSmartphone className="w-4 h-4 text-muted-foreground" />
            Supported Device Types
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {DEVICE_TYPES.map((device, i) => (
              <motion.div
                key={device.name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28 + i * 0.03 }}
              >
                <Card className="card-hover">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-9 h-9 rounded-xl ${device.bg} flex items-center justify-center`}>
                        <device.icon className={`w-4.5 h-4.5 ${device.color}`} />
                      </div>
                      <Badge variant="secondary" className="text-[10px] bg-muted/50">
                        Coming soon
                      </Badge>
                    </div>
                    <p className="text-sm font-semibold">{device.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{device.params}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Device Management - Empty State */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
        <Card className="card-hover">
          <CardContent className="p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Cpu className="w-7 h-7 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold mb-1">No devices registered</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
              Configure MQTT broker, register devices via API, and start receiving real-time
              vitals automatically in patient records.
            </p>
            <Button disabled className="gap-2" title="Connect your first IoT device">
              <Plus className="w-4 h-4" />
              Add Device
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Connect your first IoT device to get started
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
