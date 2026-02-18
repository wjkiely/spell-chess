"use client";

import { useState, useEffect, useRef } from "react";
import { getSupabaseClient } from "@/lib/supabase";

interface Message {
  id: string;
  game_id: string;
  color: "white" | "black" | "moderator";
  name: string | null;
  content: string;
  created_at: string;
}

interface Props {
  gameId: string;
  playerColor: "white" | "black" | "moderator";
  theme: "light" | "dark";
}

export default function ChatBox({ gameId, playerColor, theme }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [name, setName] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isDark = theme === "dark";

  // Load saved name from localStorage (scoped to this game)
  useEffect(() => {
    const saved = localStorage.getItem(`chatName_${gameId}_${playerColor}`);
    if (saved) setName(saved);
  }, [gameId, playerColor]);

  // Persist name to localStorage whenever it changes
  useEffect(() => {
    if (name) {
      localStorage.setItem(`chatName_${gameId}_${playerColor}`, name);
    } else {
      localStorage.removeItem(`chatName_${gameId}_${playerColor}`);
    }
  }, [name, gameId, playerColor]);

  // Fetch initial messages and subscribe to realtime updates
  useEffect(() => {
    const supabase = getSupabaseClient();

    // Fetch existing messages
    supabase
      .from("messages" as never)
      .select("*")
      .eq("game_id", gameId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setMessages(data as Message[]);
      });

    // Subscribe to inserts and deletes
    const channel = supabase
      .channel(`messages:${gameId}`)
      .on(
        "postgres_changes" as never,
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `game_id=eq.${gameId}`,
        },
        (payload: { new: Message }) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .on(
        "postgres_changes" as never,
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `game_id=eq.${gameId}`,
        },
        (payload: { old: { id: string } }) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const content = draft.trim();
    if (!content) return;
    setSending(true);
    const supabase = getSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("messages" as never) as any).insert({
      game_id: gameId,
      color: playerColor,
      name: name.trim() || null,
      content,
    });
    setDraft("");
    setSending(false);
  }

  async function handleDelete(id: string) {
    const supabase = getSupabaseClient();
    await supabase.from("messages" as never).delete().eq("id", id);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function formatSender(msg: Message) {
    const colorLabel = msg.color === "white" ? "White" : msg.color === "black" ? "Black" : "Moderator";
    return msg.name ? `${colorLabel} (${msg.name})` : colorLabel;
  }

  // Styles
  const containerCls = isDark
    ? "bg-[#2a2a2a] border-[#444] text-[#e0e0e0]"
    : "bg-white border-gray-300 text-gray-800";

  const inputCls = isDark
    ? "bg-[#3c3c3c] border-[#555] text-[#e0e0e0] placeholder-[#888]"
    : "bg-white border-gray-300 text-gray-800 placeholder-gray-400";

  const sendBtnCls = isDark
    ? "bg-blue-700 hover:bg-blue-600 text-white"
    : "bg-blue-600 hover:bg-blue-700 text-white";

  const msgRowCls = (color: "white" | "black" | "moderator") =>
    color === "white"
      ? isDark ? "text-[#e0e0e0]" : "text-gray-800"
      : color === "black"
      ? isDark ? "text-[#aaa]" : "text-gray-600"
      : isDark ? "text-[#e0e0e0]" : "text-gray-800";

  const senderCls = (color: "white" | "black" | "moderator") =>
    color === "white"
      ? isDark ? "text-[#81c784]" : "text-green-700"
      : color === "black"
      ? isDark ? "text-[#90caf9]" : "text-blue-700"
      : isDark ? "text-[#ffb74d]" : "text-orange-600";

  const deleteBtnCls = isDark
    ? "text-[#888] hover:text-red-400"
    : "text-gray-400 hover:text-red-500";

  const labelCls = isDark ? "text-[#aaa]" : "text-gray-500";

  return (
    <div className={`rounded-lg border ${containerCls} flex flex-col w-full`}>
      {/* Header */}
      <div className={`px-3 py-2 border-b text-sm font-semibold ${isDark ? "border-[#444]" : "border-gray-200"}`}>
        Chat
      </div>

      {/* Name input */}
      <div className={`px-3 py-2 border-b flex items-center gap-2 ${isDark ? "border-[#444]" : "border-gray-200"}`}>
        <span className={`text-xs flex-shrink-0 ${labelCls}`}>Your name:</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Optional"
          maxLength={20}
          className={`flex-1 rounded border px-2 py-0.5 text-xs outline-none ${inputCls}`}
        />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1" style={{ maxHeight: 180, minHeight: 80 }}>
        {messages.length === 0 && (
          <p className={`text-xs text-center mt-4 ${labelCls}`}>No messages yet. Say hello!</p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex items-start gap-1 text-xs ${msgRowCls(msg.color)}`}>
            <span className={`font-semibold flex-shrink-0 ${senderCls(msg.color)}`}>
              {formatSender(msg)}:
            </span>
            <span className="flex-1 break-words">{msg.content}</span>
            {(msg.color === playerColor || playerColor === "moderator") && (
              <button
                onClick={() => handleDelete(msg.id)}
                className={`flex-shrink-0 text-xs leading-none mt-0.5 transition-colors ${deleteBtnCls}`}
                title="Delete message"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className={`px-3 py-2 border-t flex gap-2 ${isDark ? "border-[#444]" : "border-gray-200"}`}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          maxLength={300}
          disabled={sending}
          className={`flex-1 rounded border px-2 py-1 text-sm outline-none ${inputCls}`}
        />
        <button
          onClick={handleSend}
          disabled={sending || !draft.trim()}
          className={`rounded px-3 py-1 text-sm font-medium transition-colors disabled:opacity-40 ${sendBtnCls}`}
        >
          Send
        </button>
      </div>
    </div>
  );
}
