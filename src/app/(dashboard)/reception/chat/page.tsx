"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useBranch } from "@/components/providers/branch-context"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ScrollArea } from "@/components/ui/scroll-area"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  MessageSquare,
  Send,
  X,
  Phone,
  RefreshCw,
  Search,
  Clock,
  CheckCheck,
  CircleDot,
  Headset,
  Archive,
  Smile,
  ArrowLeft,
} from "lucide-react"
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

// ─── Helpers ───

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

function formatDate(ts: string) {
  const d = new Date(ts)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return "Today"
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday"
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "now"
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

function groupMessagesByDate(messages: ChatMessage[]) {
  const groups: { date: string; messages: ChatMessage[] }[] = []
  let currentDate = ""

  for (const msg of messages) {
    const date = formatDate(msg.ts)
    if (date !== currentDate) {
      currentDate = date
      groups.push({ date, messages: [msg] })
    } else {
      groups[groups.length - 1].messages.push(msg)
    }
  }
  return groups
}

// ─── Chat List Item ───

function ChatListItem({
  chat,
  isSelected,
  onClick,
  isClosed,
}: {
  chat: LiveChat
  isSelected: boolean
  onClick: () => void
  isClosed: boolean
}) {
  const lastMsg = chat.messages[chat.messages.length - 1]
  const name = chat.patient_name || "Unknown"
  const unreadCount = chat.messages.filter(
    (m) => m.role === "patient" && !isClosed
  ).length

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 rounded-xl transition-all duration-200 group relative",
        isSelected
          ? "bg-primary/10 shadow-sm"
          : "hover:bg-muted/60"
      )}
    >
      {/* Selection indicator */}
      {isSelected && (
        <motion.div
          layoutId="chat-indicator"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-primary"
        />
      )}

      <div className="flex items-start gap-3">
        <div className="relative">
          <Avatar className="w-10 h-10">
            <AvatarFallback className={cn(
              "text-xs font-bold",
              isClosed
                ? "bg-muted text-muted-foreground"
                : "bg-gradient-to-br from-primary/20 to-primary/5 text-primary"
            )}>
              {getInitials(name)}
            </AvatarFallback>
          </Avatar>
          {!isClosed && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-background" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={cn(
              "text-sm font-semibold truncate",
              isSelected ? "text-primary" : "text-foreground"
            )}>
              {name}
            </span>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {timeAgo(chat.updated_at)}
            </span>
          </div>

          <div className="flex items-center gap-1 mt-0.5">
            <Phone className="w-3 h-3 text-muted-foreground/60 shrink-0" />
            <span className="text-[11px] text-muted-foreground/60">{chat.phone}</span>
          </div>

          {lastMsg && (
            <div className="flex items-center justify-between gap-2 mt-1">
              <p className="text-xs text-muted-foreground truncate">
                {lastMsg.role === "staff" && (
                  <span className="text-primary/70">You: </span>
                )}
                {lastMsg.content}
              </p>
              {!isClosed && lastMsg.role === "patient" && (
                <span className="shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  !
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.button>
  )
}

// ─── Message Bubble ───

function MessageBubble({ msg, isLast }: { msg: ChatMessage; isLast: boolean }) {
  if (msg.role === "system") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex justify-center my-2"
      >
        <span className="text-[10px] text-muted-foreground/70 bg-muted/50 px-3 py-1 rounded-full">
          {msg.content} &middot; {formatTime(msg.ts)}
        </span>
      </motion.div>
    )
  }

  const isStaff = msg.role === "staff"

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={cn("flex", isStaff ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm relative",
          isStaff
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted/80 text-foreground rounded-bl-md",
          isLast && !isStaff && "animate-pulse-soft"
        )}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {msg.content}
        </p>
        <div
          className={cn(
            "flex items-center gap-1.5 mt-1",
            isStaff ? "justify-end" : "justify-start"
          )}
        >
          {isStaff && msg.staff_name && (
            <span className={cn(
              "text-[10px]",
              isStaff ? "text-primary-foreground/60" : "text-muted-foreground/60"
            )}>
              {msg.staff_name}
            </span>
          )}
          <span
            className={cn(
              "text-[10px]",
              isStaff ? "text-primary-foreground/60" : "text-muted-foreground/60"
            )}
          >
            {formatTime(msg.ts)}
          </span>
          {isStaff && (
            <CheckCheck className={cn(
              "w-3 h-3",
              "text-primary-foreground/60"
            )} />
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Empty States ───

function EmptyChatList({ isClosed }: { isClosed: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center h-full py-12 px-4"
    >
      <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
        {isClosed ? (
          <Archive className="w-7 h-7 text-muted-foreground/40" />
        ) : (
          <Headset className="w-7 h-7 text-muted-foreground/40" />
        )}
      </div>
      <p className="text-sm font-medium text-muted-foreground">
        {isClosed ? "No closed chats" : "No active chats"}
      </p>
      <p className="text-xs text-muted-foreground/60 mt-1 text-center">
        {isClosed
          ? "Closed conversations from the last 24 hours will appear here"
          : "When a patient requests live support, their chat will appear here"}
      </p>
    </motion.div>
  )
}

function EmptyConversation() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex-1 flex flex-col items-center justify-center text-center px-6"
    >
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
          <MessageSquare className="w-10 h-10 text-primary/40" />
        </div>
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center"
        >
          <CircleDot className="w-3 h-3 text-primary/60" />
        </motion.div>
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">Select a conversation</h3>
      <p className="text-sm text-muted-foreground max-w-[280px]">
        Choose a patient from the left panel to start responding to their messages
      </p>
    </motion.div>
  )
}

// ─── Main Component ───

export default function LiveChatPage() {
  const { activeTenantId: tenantId } = useBranch()
  const [chats, setChats] = useState<LiveChat[]>([])
  const [closedChats, setClosedChats] = useState<LiveChat[]>([])
  const [selectedChat, setSelectedChat] = useState<LiveChat | null>(null)
  const [replyText, setReplyText] = useState("")
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showClosed, setShowClosed] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [mobileShowChat, setMobileShowChat] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const fetchChats = useCallback(async () => {
    const supabase = createBrowserClient()

    const { data: active } = await supabase
      .from("live_chats")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .order("updated_at", { ascending: false })

    if (active) setChats(active as LiveChat[])

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

  // Realtime subscription
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
            toast.info(`New chat from ${updated.patient_name || updated.phone}`, {
              icon: <Headset className="w-4 h-4" />,
            })
          } else if (payload.eventType === "UPDATE") {
            if (updated.status === "closed") {
              setChats((prev) => prev.filter((c) => c.id !== updated.id))
              setClosedChats((prev) => [updated, ...prev])
              if (selectedChat?.id === updated.id) {
                setSelectedChat(null)
                setMobileShowChat(false)
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
        inputRef.current?.focus()
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
        if (selectedChat?.id === chatId) {
          setSelectedChat(null)
          setMobileShowChat(false)
        }
      }
    } catch {
      toast.error("Failed to close chat")
    }
  }

  const handleSelectChat = (chat: LiveChat) => {
    setSelectedChat(chat)
    setMobileShowChat(true)
  }

  const displayChats = showClosed ? closedChats : chats
  const filteredChats = searchQuery
    ? displayChats.filter(
        (c) =>
          (c.patient_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.phone.includes(searchQuery)
      )
    : displayChats

  const messageGroups = selectedChat
    ? groupMessagesByDate(selectedChat.messages)
    : []

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] gap-4 h-[calc(100vh-200px)]">
          <Skeleton className="rounded-2xl" />
          <Skeleton className="rounded-2xl" />
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-5 flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl gradient-blue flex items-center justify-center text-white">
              <Headset className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-foreground tracking-tight">Live Chat</h1>
                <AnimatePresence mode="wait">
                  {chats.length > 0 && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                    >
                      <Badge className="bg-red-500 text-white border-0 text-[10px] px-2 animate-pulse-soft">
                        {chats.length} active
                      </Badge>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Respond to patient queries from WhatsApp
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-xl"
                  onClick={fetchChats}
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh chats</TooltipContent>
            </Tooltip>
          </div>
        </motion.div>

        {/* Main Chat Layout */}
        <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] gap-4 h-[calc(100vh-220px)]">

          {/* ─── LEFT: Chat List ─── */}
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn(
              "glass-card rounded-2xl overflow-hidden flex flex-col",
              mobileShowChat ? "hidden md:flex" : "flex"
            )}
          >
            {/* List Header */}
            <div className="p-3 space-y-3 border-b border-border/40">
              {/* Tabs */}
              <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1">
                <button
                  onClick={() => setShowClosed(false)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    !showClosed
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <CircleDot className="w-3 h-3" />
                  Active
                  {chats.length > 0 && (
                    <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {chats.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setShowClosed(true)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    showClosed
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Archive className="w-3 h-3" />
                  Closed
                </button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
                <Input
                  className="pl-9 h-9 text-xs rounded-xl bg-muted/30 border-transparent focus:border-primary/30"
                  placeholder="Search by name or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Chat Items */}
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                <AnimatePresence mode="popLayout">
                  {filteredChats.length === 0 ? (
                    <EmptyChatList isClosed={showClosed} />
                  ) : (
                    filteredChats.map((chat) => (
                      <ChatListItem
                        key={chat.id}
                        chat={chat}
                        isSelected={selectedChat?.id === chat.id}
                        onClick={() => !showClosed && handleSelectChat(chat)}
                        isClosed={showClosed}
                      />
                    ))
                  )}
                </AnimatePresence>
              </div>
            </ScrollArea>
          </motion.div>

          {/* ─── RIGHT: Conversation ─── */}
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn(
              "glass-card rounded-2xl overflow-hidden flex flex-col",
              !mobileShowChat ? "hidden md:flex" : "flex"
            )}
          >
            {selectedChat ? (
              <>
                {/* Conversation Header */}
                <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between bg-gradient-to-r from-background to-muted/20">
                  <div className="flex items-center gap-3">
                    {/* Mobile back button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-xl md:hidden"
                      onClick={() => setMobileShowChat(false)}
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </Button>

                    <div className="relative">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary text-xs font-bold">
                          {getInitials(selectedChat.patient_name || "U")}
                        </AvatarFallback>
                      </Avatar>
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-background" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        {selectedChat.patient_name || "Unknown Patient"}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Phone className="w-3 h-3" />
                        <span>{selectedChat.phone}</span>
                        <span className="text-muted-foreground/40">|</span>
                        <Clock className="w-3 h-3" />
                        <span>Started {formatTime(selectedChat.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedChat.assigned_to && (
                      <Badge variant="secondary" className="text-[10px] hidden sm:flex">
                        <Headset className="w-3 h-3 mr-1" />
                        {selectedChat.assigned_to}
                      </Badge>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="rounded-xl gap-1.5 h-8"
                          onClick={() => handleCloseChat(selectedChat.id)}
                        >
                          <X className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">End Chat</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Close this conversation</TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                {/* Messages Area */}
                <ScrollArea className="flex-1 px-4 py-3">
                  <div className="space-y-4 max-w-2xl mx-auto">
                    {/* Start indicator */}
                    <div className="flex justify-center mb-4">
                      <span className="text-[10px] text-muted-foreground/50 bg-muted/30 px-3 py-1 rounded-full flex items-center gap-1.5">
                        <Smile className="w-3 h-3" />
                        Chat started via WhatsApp
                      </span>
                    </div>

                    {messageGroups.map((group) => (
                      <div key={group.date}>
                        {/* Date separator */}
                        <div className="flex items-center gap-3 my-4">
                          <div className="flex-1 h-px bg-border/50" />
                          <span className="text-[10px] font-medium text-muted-foreground/60 bg-muted/30 px-3 py-0.5 rounded-full">
                            {group.date}
                          </span>
                          <div className="flex-1 h-px bg-border/50" />
                        </div>

                        {/* Messages in this group */}
                        <div className="space-y-2">
                          {group.messages.map((msg, idx) => (
                            <MessageBubble
                              key={`${msg.ts}-${idx}`}
                              msg={msg}
                              isLast={
                                idx === group.messages.length - 1 &&
                                msg.role === "patient"
                              }
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Reply Input */}
                <div className="px-4 py-3 border-t border-border/40 bg-gradient-to-r from-muted/10 to-background">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      handleSendReply()
                    }}
                    className="flex items-center gap-2 max-w-2xl mx-auto"
                  >
                    <Input
                      ref={inputRef}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type a message..."
                      disabled={sending}
                      autoFocus
                      className="flex-1 h-11 rounded-xl bg-muted/30 border-transparent focus:border-primary/30 text-sm"
                    />
                    <Button
                      type="submit"
                      disabled={sending || !replyText.trim()}
                      className="h-11 w-11 rounded-xl shrink-0"
                      size="icon"
                    >
                      <Send className={cn("w-4 h-4", sending && "animate-pulse")} />
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <EmptyConversation />
            )}
          </motion.div>
        </div>
      </div>
    </TooltipProvider>
  )
}
