import React, { useState } from "react";
import { ChevronRight, ChevronDown, Terminal, Globe, CheckCircle2, XCircle, Loader2, Code2, Wrench } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function MessageBubble({ message }: { message: any }) {
  const isUser = message.role === "user";
  
  let parsedToolCalls: any[] = [];
  try {
    if (message.toolCalls) {
      parsedToolCalls = JSON.parse(message.toolCalls);
    }
  } catch (e) {
    console.error("Failed to parse tool calls", e);
  }

  return (
    <div className={cn("flex flex-col gap-2 w-full", isUser ? "items-end" : "items-start")}>
      {!isUser && parsedToolCalls.length > 0 && (
        <div className="flex flex-col gap-2 w-full max-w-3xl">
          {parsedToolCalls.map((tc, idx) => (
            <ToolCallCard key={idx} toolCall={tc} />
          ))}
        </div>
      )}
      
      {message.content && (
        <div 
          className={cn(
            "px-4 py-3 rounded-2xl max-w-3xl text-sm whitespace-pre-wrap leading-relaxed",
            isUser 
              ? "bg-primary text-primary-foreground rounded-br-sm" 
              : "bg-card border border-border text-card-foreground rounded-bl-sm"
          )}
        >
          {message.content}
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
      <div className={cn("flex border-l-4", 
        isRunning ? "border-l-primary" : 
        isSuccess ? "border-l-green-500" : 
        "border-l-destructive"
      )}>
        <CollapsibleTrigger className="flex flex-1 items-center gap-3 px-3 py-2 hover:bg-secondary/50 transition-colors group">
          {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          
          <div className="flex items-center gap-2 flex-1">
            <Icon className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium font-mono text-foreground">
              {toolCall.toolName}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {toolCall.durationMs && (
              <span className="text-xs text-muted-foreground font-mono">
                {toolCall.durationMs}ms
              </span>
            )}
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
              <pre className="text-xs font-mono bg-card border border-border p-2 rounded overflow-x-auto text-card-foreground">
                {toolCall.input}
              </pre>
            </div>
          )}
          {toolCall.output && (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Output</div>
              <pre className={cn("text-xs font-mono bg-card border border-border p-2 rounded overflow-x-auto", isError ? "text-destructive" : "text-card-foreground")}>
                {toolCall.output}
              </pre>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
