"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useBranch } from "@/components/providers/branch-context"
import { createBrowserClient } from "@/lib/supabase/client"
import { SectionHeader } from "@/components/shared/section-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { MessageSquare, Send, X, User, Phone, RefreshCw } from "lucide-react"
import { toast } from "sonner"

interface LiveChat {
  id: string
  phone: string
  patient_name: string
  tenant_id: string
  status: "active" | "closed"
  assigned_to: string | null
  messages: ChatMessage[]
  created_at: string
  updated_at: string
  closed_at: string | null
}

interface ChatMessage {
  role: "patient" | "staff" | "system"
  content: string
  staff_name?: string
  ts: string
}

export default function LiveChatPage() {
  const { activeTenantId: tenantId } = useBranch()
  const [chats, setChats] = useState<LiveChat[]>([])
  const [closedChats, setClosedChats] = useState<LiveChat[]>([])
  const [selectedChat, setSelectedChat] = useState<LiveChat | null>(null)
  const [replyText, setReplyText] = useState("")
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showClosed, setShowClosed] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const fetchChats = useCallback(async () => {
    const supabase = createBrowserClient()

    // Fetch active chats
    const { data: active } = await supabase
      .from("live_chats")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .order("updated_at", { ascending: false })

    if (active) setChats(active as LiveChat[])

    // Fetch recent closed chats (last 24h)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: closed } = await supabase
      .from("live_chats")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("status", "closed")
      .gte("closed_at", yesterday)
      .order("closed_at", { ascending: false })
      .limit(20)

    if (closed) setClosedChats(closed as LiveChat[])
    setLoading(false)
  }, [tenantId])

  useEffect(() => {
    fetchChats()
  }, [fetchChats])

  // Realtime subscription for live_chats changes
  useEffect(() => {
    const supabase = createBrowserClient()
    const channel = supabase
      .channel(`live-chats-${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_chats",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const updated = payload.new as LiveChat
          if (payload.eventType === "INSERT") {
            setChats((prev) => [updated, ...prev])
            toast.info(`New live chat from ${updated.patient_name || updated.phone}`)
          } else if (payload.eventType === "UPDATE") {
            if (updated.status === "closed") {
              setChats((prev) => prev.filter((c) => c.id !== updated.id))
              setClosedChats((prev) => [updated, ...prev])
              if (selectedChat?.id === updated.id) {
                setSelectedChat(null)
              }
            } else {
              setChats((prev) =>
                prev.map((c) => (c.id === updated.id ? updated : c))
              )
              if (selectedChat?.id === updated.id) {
                setSelectedChat(updated)
              }
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tenantId, selectedChat?.id])

  useEffect(() => {
    scrollToBottom()
  }, [selectedChat?.messages])

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedChat) return
    setSending(true)

    try {
      const res = await fetch("/api/whatsapp/agent-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: selectedChat.id,
          message: replyText.trim(),
        }),
      })

      const data = await res.json()
      if (data.success) {
        setReplyText("")
      } else {
        toast.error("Failed to send: " + (data.error || "Unknown error"))
      }
    } catch {
      toast.error("Failed to send message")
    }

    setSending(false)
  }

  const handleCloseChat = async (chatId: string) => {
    try {
      const res = await fetch("/api/whatsapp/agent-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, action: "close" }),
      })

      const data = await res.json()
      if (data.success) {
        toast.success("Chat closed")
        if (selectedChat?.id === chatId) setSelectedChat(null)
      }
    } catch {
      toast.error("Failed to close chat")
    }
  }

  const formatTime = (ts: string) => {
    return new Date(ts).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
  }

  const displayChats = showClosed ? closedChats : chats

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-[500px]" />
          <Skeleton className="h-[500px] col-span-2" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        variant="glass"
        icon={<MessageSquare className="w-6 h-6" />}
        gradient="gradient-blue"
        title="Live Chat"
        subtitle="Respond to patient queries from WhatsApp"
        badge={
          <Badge variant={chats.length > 0 ? "destructive" : "secondary"} className="text-xs">
            {chats.length} active
          </Badge>
        }
        action={
          <div className="flex gap-2">
            <Button
              variant={showClosed ? "default" : "outline"}
              size="sm"
              onClick={() => setShowClosed(!showClosed)}
            >
              {showClosed ? "Show Active" : "Show Closed"}
            </Button>
            <Button variant="outline" size="sm" onClick={fetchChats}>
              <RefreshCw className="w-4 h-4 mr-1" /> Refresh
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-220px)]">
        {/* Chat list */}
        <Card className="glass-card overflow-hidden">
          <CardContent className="p-0">
            <div className="p-3 border-b">
              <h3 className="text-sm font-semibold text-muted-foreground">
                {showClosed ? "Closed Chats (24h)" : "Active Chats"}
              </h3>
            </div>
            <div className="overflow-y-auto max-h-[calc(100vh-300px)]">
              {displayChats.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>{showClosed ? "No closed chats in the last 24 hours" : "No active chats"}</p>
                </div>
              ) : (
                displayChats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => !showClosed && setSelectedChat(chat)}
                    className={`w-full text-left p-3 border-b transition-colors hover:bg-muted/50 ${
                      selectedChat?.id === chat.id ? "bg-primary/5 border-l-2 border-l-primary" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">
                        {chat.patient_name || "Unknown"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatTime(chat.updated_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="w-3 h-3" />
                      <span>{chat.phone}</span>
                    </div>
                    {chat.messages.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {chat.messages[chat.messages.length - 1].content}
                      </p>
                    )}
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Chat window */}
        <Card className="glass-card overflow-hidden md:col-span-2 flex flex-col">
          {selectedChat ? (
            <>
              {/* Chat header */}
              <div className="p-3 border-b flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {selectedChat.patient_name || "Unknown Patient"}
                    </p>
                    <p className="text-xs text-muted-foreground">{selectedChat.phone}</p>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleCloseChat(selectedChat.id)}
                >
                  <X className="w-4 h-4 mr-1" /> End Chat
                </Button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[calc(100vh-400px)]">
                {selectedChat.messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${
                      msg.role === "staff" ? "justify-end" : msg.role === "system" ? "justify-center" : "justify-start"
                    }`}
                  >
                    {msg.role === "system" ? (
                      <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                        {msg.content} - {formatTime(msg.ts)}
                      </span>
                    ) : (
                      <div
                        className={`max-w-[70%] rounded-lg px-3 py-2 ${
                          msg.role === "staff"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <p
                          className={`text-[10px] mt-1 ${
                            msg.role === "staff" ? "text-primary-foreground/70" : "text-muted-foreground"
                          }`}
                        >
                          {msg.role === "staff" && msg.staff_name
                            ? `${msg.staff_name} · `
                            : ""}
                          {formatTime(msg.ts)}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply input */}
              <div className="p-3 border-t">
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleSendReply()
                  }}
                  className="flex gap-2"
                >
                  <Input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your reply..."
                    disabled={sending}
                    autoFocus
                  />
                  <Button type="submit" disabled={sending || !replyText.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <CardContent className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a chat to start responding</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  )
}
