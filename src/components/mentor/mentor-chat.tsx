"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowUp, Bot, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { MENTOR_CONFIG } from "@/config/engine";
import { cn } from "@/lib/utils";
import { Markdown } from "./markdown";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string; pending?: boolean };
type StreamEvent =
  | { type: "start"; userMessageId: string }
  | { type: "delta"; text: string }
  | { type: "done"; messageId: string; conversationId: string; title: string }
  | { type: "error"; message: string };

export function MentorChat({
  conversationId: initialConversationId,
  initialMessages,
  suggestions,
  taskId,
  careerName,
}: {
  conversationId: string | null;
  initialMessages: ChatMessage[];
  suggestions: string[];
  taskId?: string;
  careerName: string | null;
}) {
  const router = useRouter();
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; question: string } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const tempId = useRef(0);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function ask(question: string) {
    const content = question.trim();
    if (!content || busy) return;
    setBusy(true);
    setError(null);
    setInput("");
    const tempUser: ChatMessage = { id: `pending-user-${++tempId.current}`, role: "user", content };
    const tempAssistant: ChatMessage = { id: `pending-assistant-${tempId.current}`, role: "assistant", content: "", pending: true };
    setMessages((m) => [...m, tempUser, tempAssistant]);

    const fail = (message: string) => {
      setMessages((m) => m.filter((x) => x.id !== tempUser.id && x.id !== tempAssistant.id));
      setError({ message, question: content });
      setInput(content);
      setBusy(false);
      textareaRef.current?.focus();
    };

    try {
      let id = conversationId;
      if (!id) {
        const created = await apiFetch<{ id: string }>("/api/mentor/conversations", {
          method: "POST",
          json: taskId ? { taskId } : {},
        });
        id = created.id;
        setConversationId(id);
      }

      const response = await fetch(`/api/mentor/conversations/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskId ? { content, taskId } : { content }),
      });
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        return fail(body?.error?.message ?? "The mentor is unavailable right now. Try again shortly.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;
      while (!finished) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          const event = JSON.parse(line) as StreamEvent;
          if (event.type === "delta") {
            setMessages((m) => m.map((x) => (x.id === tempAssistant.id ? { ...x, content: x.content + event.text } : x)));
          } else if (event.type === "error") {
            return fail(event.message);
          } else if (event.type === "done") {
            finished = true;
            setMessages((m) => m.map((x) => (x.id === tempAssistant.id ? { ...x, id: event.messageId, pending: false } : x)));
            if (!initialConversationId) router.replace(`/mentor/${event.conversationId}`, { scroll: false });
            router.refresh();
          }
        }
      }
      if (!finished) return fail("The response was interrupted. Try again.");
      setBusy(false);
    } catch (e) {
      fail(e instanceof ApiClientError ? e.message : "Can't reach the mentor. Check your connection and try again.");
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-13rem)] flex-col">
      <div className="flex-1" aria-live="polite" aria-busy={busy}>
        {messages.length === 0 ? (
          <div className="surface p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30" aria-hidden>
                <Bot className="size-5" />
              </span>
              <div>
                <h2 className="text-lg leading-snug font-semibold">Ask about anything you are learning</h2>
                <p className="mt-1 max-w-prose text-sm leading-snug text-muted-foreground">
                  The mentor sees your {careerName ? `${careerName} ` : ""}skill gaps, current roadmap week and, when relevant,
                  your latest practical feedback, and explains at your level.
                </p>
              </div>
            </div>
            {suggestions.length > 0 && (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void ask(s)}
                    disabled={busy}
                    className="group flex items-start gap-2 rounded-lg border border-primary/25 bg-accent/30 px-3 py-2.5 text-left text-sm leading-snug outline-none transition-colors hover:border-primary/60 hover:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
                  >
                    <MessageSquare className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    <span>{s}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <ol className="grid gap-4 pb-4">
            {messages.map((m) => (
              <li key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                {m.role === "user" ? (
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm border border-primary/40 bg-primary/15 px-3.5 py-2 leading-snug whitespace-pre-wrap text-foreground">
                    <span className="sr-only">You: </span>
                    {m.content}
                  </div>
                ) : (
                  <div className="flex max-w-[92%] gap-2.5">
                    <span
                      className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground ring-2 ring-primary/25"
                      aria-hidden
                    >
                      <Bot className="size-4" />
                    </span>
                    <div className="min-w-0 rounded-2xl rounded-tl-sm border bg-card px-3.5 py-2.5 leading-relaxed shadow-[0_8px_24px_-18px_rgb(0_0_0/0.4)]">
                      <span className="sr-only">Mentor: </span>
                      {m.pending && !m.content ? (
                        <span className="inline-flex items-center gap-2 text-muted-foreground">
                          <Loader2 className="size-4 animate-spin text-primary" /> Thinking
                        </span>
                      ) : (
                        <Markdown text={m.content} />
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <Alert variant="destructive" className="mb-3">
          <AlertCircle />
          <AlertDescription className="flex flex-wrap items-center gap-3">
            {error.message}
            <Button size="sm" variant="outline" onClick={() => void ask(error.question)} disabled={busy}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <form
        className="sticky bottom-0 bg-background pt-2 pb-2"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
      >
        <label htmlFor="mentor-input" className="sr-only">
          Your question
        </label>
        <div className="flex items-end gap-2 rounded-xl border border-primary/30 bg-card p-2 shadow-[0_8px_24px_-16px_rgb(0_0_0/0.4)] transition-colors focus-within:border-primary/60 focus-within:ring-3 focus-within:ring-ring/40">
          <textarea
            id="mentor-input"
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask(input);
              }
            }}
            rows={2}
            maxLength={MENTOR_CONFIG.maxMessageLength}
            placeholder="Ask a question, paste an error, or describe what is confusing you"
            className="max-h-48 min-h-10 flex-1 resize-y bg-transparent px-2 py-1.5 text-sm outline-none"
          />
          <Button type="submit" size="icon-lg" className="rounded-lg" disabled={busy || !input.trim()} aria-label="Send question">
            {busy ? <Loader2 className="animate-spin" /> : <ArrowUp />}
          </Button>
        </div>
        <p className="mt-1.5 px-1 text-xs text-muted-foreground">
          AI answers can be wrong. Enter to send, Shift+Enter for a new line. {input.length}/{MENTOR_CONFIG.maxMessageLength}
        </p>
      </form>
    </div>
  );
}
