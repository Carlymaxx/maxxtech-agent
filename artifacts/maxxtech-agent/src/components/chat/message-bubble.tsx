import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import {
  ChevronRight, ChevronDown, Terminal, Globe, CheckCircle2,
  XCircle, Loader2, Wrench, Copy, Check, Pencil, Zap,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

/* ── Copy-button for code blocks ─────────────────────────────────── */
function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="my-3 rounded-xl overflow-hidden border border-white/10 shadow-lg">
      <div className="flex items-center justify-between bg-[#161b22] px-4 py-2.5 border-b border-white/10">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
          {language || "code"}
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="bg-[#0d1117] px-5 py-4 overflow-x-auto text-[13px] leading-relaxed">
        <code className={`language-${language} text-slate-200 font-mono`}>{code}</code>
      </pre>
    </div>
  );
}

/* ── Custom renderers — no raw asterisks or hashes ───────────────── */
function buildComponents(isStreaming?: boolean): Components {
  return {
    // Paragraphs
    p: ({ children }) => (
      <p className="text-[15px] leading-[1.75] text-foreground/95 mb-4 last:mb-0">{children}</p>
    ),
    // Headings
    h1: ({ children }) => (
      <h1 className="text-2xl font-bold text-foreground mt-6 mb-3 pb-2 border-b border-border">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-xl font-semibold text-foreground mt-5 mb-2.5">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-base font-semibold text-foreground mt-4 mb-2">{children}</h3>
    ),
    h4: ({ children }) => (
      <h4 className="text-sm font-semibold text-foreground mt-3 mb-1.5">{children}</h4>
    ),
    // Inline code
    code: ({ className, children, ...props }) => {
      const isBlock = !!className?.startsWith("language-");
      if (isBlock) return <code {...props}>{children}</code>;
      return (
        <code className="px-1.5 py-0.5 rounded-md bg-primary/15 text-primary text-[13px] font-mono font-medium border border-primary/20">
          {children}
        </code>
      );
    },
    // Code blocks
    pre: ({ children }) => {
      const child = children as React.ReactElement<{ className?: string; children?: string }>;
      const className = child?.props?.className ?? "";
      const lang = className.replace("language-", "") || "";
      const code = String(child?.props?.children ?? "").replace(/\n$/, "");
      return <CodeBlock language={lang} code={code} />;
    },
    // Unordered list
    ul: ({ children }) => (
      <ul className="my-3 space-y-1.5 pl-1">{children}</ul>
    ),
    li: ({ children, ...props }) => {
      const ordered = (props as any).ordered;
      return (
        <li className="flex gap-2.5 items-start text-[15px] leading-relaxed text-foreground/95">
          {!ordered && (
            <span className="mt-2 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
          )}
          <span className="flex-1">{children}</span>
        </li>
      );
    },
    // Ordered list
    ol: ({ children }) => (
      <ol className="my-3 space-y-1.5 pl-1 list-decimal list-inside">{children}</ol>
    ),
    // Blockquote
    blockquote: ({ children }) => (
      <blockquote className="my-3 pl-4 border-l-2 border-primary/50 text-foreground/70 italic text-[14px] leading-relaxed">
        {children}
      </blockquote>
    ),
    // Horizontal rule
    hr: () => <hr className="my-5 border-border" />,
    // Strong / bold
    strong: ({ children }) => (
      <strong className="font-semibold text-foreground">{children}</strong>
    ),
    // Emphasis
    em: ({ children }) => (
      <em className="italic text-foreground/90">{children}</em>
    ),
    // Links
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
      >
        {children}
      </a>
    ),
    // Table
    table: ({ children }) => (
      <div className="my-4 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-[13px] text-left">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-secondary/60 text-foreground/80 font-semibold">{children}</thead>
    ),
    tbody: ({ children }) => <tbody className="divide-y divide-border">{children}</tbody>,
    tr: ({ children }) => <tr className="hover:bg-secondary/30 transition-colors">{children}</tr>,
    th: ({ children }) => (
      <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</th>
    ),
    td: ({ children }) => <td className="px-4 py-2.5 text-foreground/90">{children}</td>,
  };
}

/* ── Main MessageBubble ──────────────────────────────────────────── */
interface MessageBubbleProps {
  message: any;
  isStreaming?: boolean;
  onEdit?: (id: number, newContent: string) => void;
}

export function MessageBubble({ message, isStreaming, onEdit }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content ?? "");

  let parsedToolCalls: any[] = [];
  try { if (message.toolCalls) parsedToolCalls = JSON.parse(message.toolCalls); } catch {}

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content ?? "").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [message.content]);

  return (
    <div className={cn("group flex gap-3 w-full", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      {!isUser && (
        <div className="shrink-0 w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center mt-0.5">
          <Zap className="w-4 h-4 text-primary" />
        </div>
      )}

      <div className={cn("flex flex-col gap-1 max-w-[85%]", isUser ? "items-end" : "items-start")}>
        {/* Tool calls */}
        {!isUser && parsedToolCalls.length > 0 && (
          <div className="flex flex-col gap-2 w-full">
            {parsedToolCalls.map((tc: any, idx: number) => <ToolCallCard key={idx} toolCall={tc} />)}
          </div>
        )}

        {/* Attached images */}
        {message.images?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.images.map((img: string, i: number) => (
              <img key={i} src={img} alt="Attached" className="rounded-xl max-h-52 max-w-xs object-cover border border-border shadow" />
            ))}
          </div>
        )}

        {/* Message content */}
        {message.content && (
          <>
            {editing ? (
              <div className="flex flex-col gap-2 w-full">
                <textarea
                  className="w-full min-h-[80px] p-3 rounded-xl bg-card border border-primary text-sm font-sans resize-none focus:outline-none"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs rounded-lg bg-secondary hover:bg-secondary/80">Cancel</button>
                  <button onClick={() => { onEdit?.(message.id, editValue); setEditing(false); }} className="px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">Save</button>
                </div>
              </div>
            ) : isUser ? (
              /* User bubble */
              <div className="px-4 py-3 rounded-2xl rounded-tr-sm bg-primary text-primary-foreground text-[14px] leading-relaxed whitespace-pre-wrap shadow-sm">
                {message.content}
              </div>
            ) : (
              /* AI response — clean, ChatGPT-style */
              <div className="rounded-2xl rounded-tl-sm bg-card/60 border border-border/60 px-5 py-4 shadow-sm w-full backdrop-blur-sm">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={buildComponents(isStreaming)}
                >
                  {message.content}
                </ReactMarkdown>
                {isStreaming && (
                  <span className="inline-block w-2 h-4 bg-primary/80 animate-pulse rounded-sm ml-0.5 align-text-bottom" />
                )}
              </div>
            )}

            {/* Action buttons */}
            {!editing && !isStreaming && (
              <div className={cn(
                "flex items-center gap-1 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150",
                isUser ? "flex-row-reverse" : "flex-row"
              )}>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary text-xs transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied!" : "Copy"}
                </button>
                {isUser && onEdit && (
                  <button
                    onClick={() => { setEditValue(message.content); setEditing(true); }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary text-xs transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Tool call card ──────────────────────────────────────────────── */
function ToolCallCard({ toolCall }: { toolCall: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const isRunning = toolCall.status === "running";
  const isSuccess = toolCall.status === "success";
  const isError = toolCall.status === "error";
  let Icon = Wrench;
  if (toolCall.toolName === "bash" || toolCall.toolName === "runCode") Icon = Terminal;
  if (toolCall.toolName === "webSearch") Icon = Globe;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full bg-card/60 border border-border/60 rounded-xl overflow-hidden shadow-sm">
      <div className={cn("flex border-l-[3px]", isRunning ? "border-l-primary" : isSuccess ? "border-l-emerald-500" : "border-l-destructive")}>
        <CollapsibleTrigger className="flex flex-1 items-center gap-3 px-4 py-2.5 hover:bg-secondary/40 transition-colors">
          {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          <div className="flex items-center gap-2 flex-1">
            <Icon className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium font-mono">{toolCall.toolName}</span>
          </div>
          <div className="flex items-center gap-2">
            {toolCall.durationMs && <span className="text-xs text-muted-foreground font-mono">{toolCall.durationMs}ms</span>}
            {isRunning && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
            {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
            {isError && <XCircle className="w-4 h-4 text-destructive" />}
          </div>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="border-t border-border bg-background/40 p-4 space-y-3">
          {toolCall.input && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Input</p>
              <pre className="text-xs font-mono bg-[#0d1117] border border-white/10 p-3 rounded-lg overflow-x-auto text-slate-300">{toolCall.input}</pre>
            </div>
          )}
          {toolCall.output && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Output</p>
              <pre className={cn("text-xs font-mono bg-[#0d1117] border border-white/10 p-3 rounded-lg overflow-x-auto", isError ? "text-red-400" : "text-slate-300")}>{toolCall.output}</pre>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
