import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ChevronRight, ChevronDown, Terminal, Globe, CheckCircle2,
  XCircle, Loader2, Wrench, Copy, Check, Pencil, X, ImageIcon,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
  try {
    if (message.toolCalls) parsedToolCalls = JSON.parse(message.toolCalls);
  } catch {}

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content ?? "").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [message.content]);

  const handleSaveEdit = () => {
    onEdit?.(message.id, editValue);
    setEditing(false);
  };

  return (
    <div className={cn("group flex flex-col gap-2 w-full", isUser ? "items-end" : "items-start")}>
      {!isUser && parsedToolCalls.length > 0 && (
        <div className="flex flex-col gap-2 w-full max-w-3xl">
          {parsedToolCalls.map((tc: any, idx: number) => (
            <ToolCallCard key={idx} toolCall={tc} />
          ))}
        </div>
      )}

      {/* Attached images */}
      {message.images && message.images.length > 0 && (
        <div className="flex flex-wrap gap-2 max-w-3xl">
          {message.images.map((img: string, i: number) => (
            <img
              key={i}
              src={img}
              alt="Attached"
              className="rounded-lg max-h-48 max-w-xs object-cover border border-border"
            />
          ))}
        </div>
      )}

      {message.content && (
        <div className="flex flex-col gap-1 max-w-3xl w-full">
          {editing ? (
            <div className="flex flex-col gap-2">
              <textarea
                className="w-full min-h-[80px] p-3 rounded-2xl bg-card border border-primary text-sm font-sans resize-none focus:outline-none"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setEditing(false)}
                  className="px-3 py-1.5 text-xs rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "px-4 py-3 rounded-2xl text-sm leading-relaxed w-full",
                isUser
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-card border border-border text-card-foreground rounded-bl-sm"
              )}
            >
              {isUser ? (
                <p className="whitespace-pre-wrap">{message.content}</p>
              ) : (
                <div className="prose prose-sm prose-invert max-w-none
                  prose-p:leading-relaxed prose-p:my-1
                  prose-headings:font-bold prose-headings:text-foreground
                  prose-code:bg-secondary prose-code:text-primary prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
                  prose-pre:bg-[#0d1117] prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-pre:p-4 prose-pre:overflow-x-auto
                  prose-a:text-primary prose-a:underline
                  prose-ul:list-disc prose-ol:list-decimal
                  prose-li:my-0.5
                  prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground
                  prose-table:border-collapse prose-th:border prose-th:border-border prose-th:p-2 prose-td:border prose-td:border-border prose-td:p-2
                ">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.content}
                  </ReactMarkdown>
                  {isStreaming && (
                    <span className="inline-block w-2 h-4 bg-primary/70 animate-pulse rounded-sm ml-0.5 align-text-bottom" />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          {!editing && !isStreaming && (
            <div className={cn(
              "flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150",
              isUser ? "justify-end pr-1" : "justify-start pl-1"
            )}>
              <button
                onClick={handleCopy}
                title="Copy"
                className="flex items-center gap-1 px-2 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary text-xs transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? "Copied!" : "Copy"}</span>
              </button>
              {isUser && onEdit && (
                <button
                  onClick={() => { setEditValue(message.content); setEditing(true); }}
                  title="Edit"
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary text-xs transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ToolCallCard({ toolCall }: { toolCall: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const isRunning = toolCall.status === "running";
  const isSuccess = toolCall.status === "success";
  const isError = toolCall.status === "error";
  let Icon = Wrench;
  if (toolCall.toolName === "bash" || toolCall.toolName === "runCode") Icon = Terminal;
  if (toolCall.toolName === "webSearch") Icon = Globe;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full max-w-2xl bg-card border border-border rounded-lg overflow-hidden flex flex-col">
      <div className={cn("flex border-l-4", isRunning ? "border-l-primary" : isSuccess ? "border-l-green-500" : "border-l-destructive")}>
        <CollapsibleTrigger className="flex flex-1 items-center gap-3 px-3 py-2 hover:bg-secondary/50 transition-colors">
          {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          <div className="flex items-center gap-2 flex-1">
            <Icon className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium font-mono">{toolCall.toolName}</span>
          </div>
          <div className="flex items-center gap-2">
            {toolCall.durationMs && <span className="text-xs text-muted-foreground font-mono">{toolCall.durationMs}ms</span>}
            {isRunning && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
            {isSuccess && <CheckCircle2 className="w-4 h-4 text-green-500" />}
            {isError && <XCircle className="w-4 h-4 text-destructive" />}
          </div>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="border-t border-border bg-background/50 p-3 space-y-3">
          {toolCall.input && (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Input</div>
              <pre className="text-xs font-mono bg-card border border-border p-2 rounded overflow-x-auto">{toolCall.input}</pre>
            </div>
          )}
          {toolCall.output && (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Output</div>
              <pre className={cn("text-xs font-mono bg-card border border-border p-2 rounded overflow-x-auto", isError ? "text-destructive" : "")}>{toolCall.output}</pre>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
