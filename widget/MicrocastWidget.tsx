import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Send } from "lucide-react";

type MessageRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: MessageRole;
  text: string;
};

type ProductAssistantConfig = {
  title: string;
  welcomeMessage?: string;
  suggestedPrompts: string[];
};

type ProductAssistantProps = {
  config?: ProductAssistantConfig;
  onAsk?: (question: string) => Promise<string>;
};

const DEFAULT_CONFIG: ProductAssistantConfig = {
  title: "Mizuno Product",
  welcomeMessage: undefined,
  suggestedPrompts: [
    "Is this shoe breathable?",
    "Does this shoe help with stability?",
    "Is this shoe good for volleyball?",
    "How does this shoe fit?",
    "What kind of cushioning does this shoe use?",
  ],
};

function createMessage(role: MessageRole, text: string, id?: string): ChatMessage {
  return {
    id: id ?? createId(),
    role,
    text,
  };
}

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getInitialMessages(config: ProductAssistantConfig): ChatMessage[] {
  return config.welcomeMessage ? [createMessage("assistant", config.welcomeMessage, "welcome")] : [];
}

function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function scrollToBottomSmooth(element: HTMLDivElement, duration = 650): () => void {
  const start = element.scrollTop;
  const target = Math.max(0, element.scrollHeight - element.clientHeight);
  const distance = target - start;

  if (distance <= 1) return () => {};

  const startedAt = performance.now();
  let rafId = 0;

  const frame = (now: number) => {
    const progress = Math.min((now - startedAt) / duration, 1);
    const next = start + distance * easeOutExpo(progress);
    element.scrollTop = Math.min(target, next);

    if (progress < 1 && element.scrollTop < target) {
      rafId = requestAnimationFrame(frame);
    }
  };

  rafId = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(rafId);
}

function LoadingDots() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18 }}
      className="flex justify-start"
    >
      <div className="flex items-center justify-center gap-1.5 border border-[#d6dbe1] bg-white px-3 py-2 shadow-[0_1px_0_rgba(255,255,255,0.65)]">
        {[0, 0.12, 0.24].map((delay, i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-[#9aa8b2]"
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -1.5, 0] }}
            transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut", delay }}
          />
        ))}
      </div>
    </motion.div>
  );
}

async function defaultAsk(question: string): Promise<string> {
  // Always use full Netlify URL to avoid 405/404 issues across environments
  const BASE_URL = "https://delightful-horse-c3836b.netlify.app";

  const res = await fetch(`${BASE_URL}/.netlify/functions/product-ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      productUrl: typeof window !== "undefined" ? window.location.href : undefined,
      extraUrls: ["https://usa.mizuno.com/"],
    }),
  });

  let data: { answer?: string; error?: string } | null = null;

  try {
    data = (await res.json()) as { answer?: string; error?: string };
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(data?.error || `Request failed with status ${res.status}`);
  }

  return data?.answer || "Sorry, I could not generate an answer.";
}

function PromptButton({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-fit max-w-full items-start gap-3 border border-[#cfd4da] bg-[#f7f7f7] px-4 py-3 text-left text-[15px] leading-[1.35] text-[#6b7280] transition hover:bg-white"
    >
      <Sparkles className="mt-[1px] h-3.5 w-3.5 shrink-0 text-[#5f7f92]" fill="currentColor" />
      <span className="whitespace-normal break-words">{text}</span>
    </button>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, x: isUser ? 16 : -16, y: 8 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className={isUser ? "flex justify-end" : "flex justify-start"}
    >
      <div
        className={
          isUser
            ? "max-w-[85%] whitespace-pre-line bg-[#dfe6eb] px-3 py-2 text-sm leading-6 text-[#374151]"
            : "max-w-[85%] whitespace-pre-line border border-[#d6dbe1] bg-white px-3 py-2 text-sm leading-6 text-[#4b5563] shadow-[0_1px_0_rgba(255,255,255,0.65)]"
        }
      >
        {message.text}
      </div>
    </motion.div>
  );
}

function runRuntimeAssertions() {
  const userMessage = createMessage("user", "test question", "test-user");
  const assistantMessage = createMessage("assistant", "test answer", "test-assistant");

  console.assert(userMessage.role === "user", "user message role should be 'user'");
  console.assert(assistantMessage.role === "assistant", "assistant message role should be 'assistant'");
  console.assert(getInitialMessages({ ...DEFAULT_CONFIG, welcomeMessage: undefined }).length === 0, "no welcome message should produce no initial messages");
  console.assert(getInitialMessages(DEFAULT_CONFIG)[0]?.role === "assistant", "welcome message should be assistant role");
}

export default function MicrocastWidgetRewrite({
  config = DEFAULT_CONFIG,
  onAsk = defaultAsk,
}: ProductAssistantProps) {
  const [input, setInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => getInitialMessages(config));
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    runRuntimeAssertions();
  }, []);

  useEffect(() => {
    setMessages(getInitialMessages(config));
  }, [config]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let cleanup = () => {};
    const rafId = requestAnimationFrame(() => {
      cleanup = scrollToBottomSmooth(el, 700);
    });

    return () => {
      cancelAnimationFrame(rafId);
      cleanup();
    };
  }, [messages.length, loading]);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setMessages((prev) => [...prev, createMessage("user", trimmed)]);
    setInput("");
    setLoading(true);

    try {
      const answer = await onAsk(trimmed);
      setMessages((prev) => [...prev, createMessage("assistant", answer)]);
    } catch (error) {
      console.error("Widget request failed:", error);
      setMessages((prev) => [
        ...prev,
        createMessage("assistant", "Sorry, something went wrong while generating an answer."),
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white p-3 sm:p-6">
      <div className="mx-auto max-w-[540px] border border-[#cfd4da] bg-[#f3f3f3] p-4 sm:p-5">
        <div className="flex flex-col gap-2.5">
          {config.suggestedPrompts.map((prompt) => (
            <PromptButton key={prompt} text={prompt} onClick={() => ask(prompt)} />
          ))}
        </div>

        <div ref={scrollRef} className="mt-4 max-h-[240px] overflow-y-auto pr-1">
          <div className="space-y-2 pb-1">
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {loading ? <LoadingDots key="loading-dots" /> : null}
            </AnimatePresence>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSend) ask(input);
          }}
          className="mt-4 flex items-stretch gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="ask a question about this Mizuno product..."
            disabled={loading}
            className="h-[42px] flex-1 border border-[#c5ccd3] bg-[#f3f3f3] px-4 text-[15px] text-[#6b7280] outline-none placeholder:text-[#98a1ab] focus:bg-white disabled:cursor-not-allowed disabled:opacity-70"
          />
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send question"
            className="flex h-[42px] w-[42px] items-center justify-center border border-[#c5ccd3] bg-white text-[#5f7f92] transition hover:bg-[#eef2f5] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
