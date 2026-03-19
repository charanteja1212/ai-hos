"use client"

import { useState, useRef, useEffect } from "react"
import { FeatureGate } from "@/components/shared/feature-gate"
import { SectionHeader } from "@/components/shared/section-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { motion, AnimatePresence } from "framer-motion"
import {
  Bot,
  Send,
  Sparkles,
  Brain,
  Stethoscope,
  Pill,
  FileText,
  Loader2,
} from "lucide-react"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

const quickActions = [
  {
    title: "Drug Interactions",
    description: "Check drug-drug interactions",
    icon: Pill,
    color: "text-red-500",
    bg: "bg-red-50 dark:bg-red-900/20",
    prompt: "Check for drug interactions between the following medications: ",
  },
  {
    title: "Differential Diagnosis",
    description: "Symptom analysis helper",
    icon: Brain,
    color: "text-purple-500",
    bg: "bg-purple-50 dark:bg-purple-900/20",
    prompt: "Help me with a differential diagnosis for a patient presenting with: ",
  },
  {
    title: "Treatment Guidelines",
    description: "Evidence-based protocols",
    icon: FileText,
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    prompt: "What are the current treatment guidelines and protocol for: ",
  },
  {
    title: "Clinical Summary",
    description: "Generate patient summary",
    icon: Sparkles,
    color: "text-amber-500",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    prompt: "Generate a clinical summary for a patient with the following details: ",
  },
]

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Hello, Doctor! I'm your AI clinical assistant. I can help with drug interactions, differential diagnoses, treatment guidelines, and clinical summaries. How can I assist you today?",
  timestamp: new Date(),
}

function getSimulatedResponse(message: string): string {
  const lower = message.toLowerCase()

  if (lower.includes("drug") || lower.includes("interaction") || lower.includes("medication")) {
    return `**Drug Interaction Analysis**

Based on your query, here are key considerations:

- **CYP450 Interactions**: Always check for cytochrome P450 enzyme inhibitors/inducers when combining medications.
- **Contraindications**: Verify renal and hepatic function before prescribing combinations.
- **Monitoring**: Consider therapeutic drug monitoring for narrow therapeutic index drugs.
- **Timing**: Some interactions can be mitigated by adjusting administration times.

Please provide the specific drug names for a more detailed interaction check.

_Note: This is a demo. Connect your OpenAI API key in settings to enable full AI responses._`
  }

  if (lower.includes("diagnosis") || lower.includes("symptom") || lower.includes("differential")) {
    return `**Differential Diagnosis Helper**

To provide an accurate differential, I'll consider:

1. **Primary symptoms** and their onset/duration
2. **Associated symptoms** and risk factors
3. **Patient demographics** (age, sex, comorbidities)
4. **Red flags** requiring urgent evaluation

Please provide the specific symptoms, vitals, and relevant history for a structured differential diagnosis list.

_Note: This is a demo. Connect your OpenAI API key in settings to enable full AI responses._`
  }

  if (lower.includes("guideline") || lower.includes("protocol") || lower.includes("treatment")) {
    return `**Treatment Guidelines Reference**

I can reference evidence-based guidelines from:

- **WHO** essential treatment protocols
- **National formulary** recommendations
- **Specialty society** consensus guidelines
- **Recent meta-analyses** and systematic reviews

Please specify the condition or clinical scenario for targeted guideline recommendations.

_Note: This is a demo. Connect your OpenAI API key in settings to enable full AI responses._`
  }

  if (lower.includes("summary") || lower.includes("clinical") || lower.includes("patient")) {
    return `**Clinical Summary Generator**

I can help structure a clinical summary including:

- **Chief complaint** and history of present illness
- **Relevant past medical/surgical history**
- **Current medications** and allergies
- **Examination findings** and investigations
- **Assessment and plan**

Please provide the patient details and I'll generate a formatted clinical summary.

_Note: This is a demo. Connect your OpenAI API key in settings to enable full AI responses._`
  }

  return `I can help with drug interactions, differential diagnoses, treatment guidelines, and clinical summaries. Please provide more details about what you need, and I'll do my best to assist.

_Note: This is a demo. Connect your OpenAI API key in settings to enable full AI responses._`
}

function AIAssistantContent() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || isTyping) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsTyping(true)

    // Simulate typing delay
    await new Promise((resolve) => setTimeout(resolve, 1500))

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: getSimulatedResponse(trimmed),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, assistantMessage])
    setIsTyping(false)
  }

  const handleQuickAction = (prompt: string) => {
    setInput(prompt)
    inputRef.current?.focus()
  }

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })

  return (
    <div className="space-y-6">
      <SectionHeader
        variant="glass"
        icon={<Bot className="w-6 h-6" />}
        gradient="gradient-purple"
        title="AI Clinical Assistant"
        subtitle="GPT-4 powered clinical decision support"
        badge={<Badge variant="outline" className="text-purple-600 border-purple-300 dark:text-purple-400 dark:border-purple-700">Beta</Badge>}
      />

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {quickActions.map((action) => (
          <motion.div
            key={action.title}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow border-border/60"
              onClick={() => handleQuickAction(action.prompt)}
            >
              <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                <div className={`w-10 h-10 rounded-xl ${action.bg} flex items-center justify-center`}>
                  <action.icon className={`w-5 h-5 ${action.color}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{action.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Chat Interface */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          {/* Messages Area */}
          <div className="h-[420px] overflow-y-auto p-4 space-y-4">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      msg.role === "assistant"
                        ? "bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/40"
                        : "bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Stethoscope className="w-3.5 h-3.5 text-purple-500" />
                        <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                          AI Assistant
                        </span>
                      </div>
                    )}
                    <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {msg.content.split(/(\*\*.*?\*\*)/g).map((part, i) =>
                        part.startsWith("**") && part.endsWith("**") ? (
                          <strong key={i}>{part.slice(2, -2)}</strong>
                        ) : part.startsWith("_") && part.endsWith("_") ? (
                          <em key={i} className="text-muted-foreground text-xs">{part.slice(1, -1)}</em>
                        ) : (
                          <span key={i}>{part}</span>
                        )
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 mt-1.5 text-right">
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Typing Indicator */}
            {isTyping && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/40 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Stethoscope className="w-3.5 h-3.5 text-purple-500" />
                    <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                      AI Assistant
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
                    <span className="text-sm text-muted-foreground">Analyzing...</span>
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-border/60 p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSend()
              }}
              className="flex items-center gap-2"
            >
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about drug interactions, symptoms, guidelines..."
                className="flex-1"
                disabled={isTyping}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || isTyping}
                className="bg-purple-600 hover:bg-purple-700 text-white shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
            <p className="text-[11px] text-muted-foreground/70 mt-2 text-center">
              AI suggestions are for reference only. Always verify with clinical guidelines and your professional judgment.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AIClinicalAssistantPage() {
  return (
    <FeatureGate feature="ai_agents" featureName="AI Clinical Assistant">
      <AIAssistantContent />
    </FeatureGate>
  )
}
