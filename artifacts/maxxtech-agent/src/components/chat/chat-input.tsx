import React, { useState, useRef, useEffect } from "react";
import { Send, Terminal, Globe, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const MODELS = [
  { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet" },
  { id: "gpt-4o", name: "GPT-4o" },
  { id: "gemini-1-5-pro", name: "Gemini 1.5 Pro" }
];

const CHIPS = [
  { label: "Run code", icon: Terminal, action: "Run this code:\n\n```javascript\n\n```" },
  { label: "Search web", icon: Globe, action: "Search the web for: " },
  { label: "Explain this", icon: HelpCircle, action: "Explain how this works: " }
];

export function ChatInput({ onSend, disabled }: { onSend: (content: string, model: string) => void, disabled?: boolean }) {
  const [content, setContent] = useState("");
  const [model, setModel] = useState(MODELS[0].id);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (!content.trim() || disabled) return;
    onSend(content.trim(), model);
    setContent("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-col gap-2">
      <div className="flex items-center gap-2 mb-1 px-1">
        {CHIPS.map((chip) => {
          const Icon = chip.icon;
          return (
            <button
              key={chip.label}
              onClick={() => {
                setContent((prev) => prev ? `${prev}\n${chip.action}` : chip.action);
                textareaRef.current?.focus();
              }}
              className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/50 transition-colors"
            >
              <Icon className="w-3.5 h-3.5 text-muted-foreground" />
              {chip.label}
            </button>
          );
        })}
      </div>

      <div className="relative flex flex-col bg-card border border-border rounded-xl shadow-sm focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all overflow-hidden">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Ask MaxxTech Agent anything..."
          className="min-h-[60px] max-h-[200px] w-full resize-none bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-4 pb-12 text-sm leading-relaxed"
          disabled={disabled}
        />
        
        <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between">
          <Select value={model} onValueChange={setModel} disabled={disabled}>
            <SelectTrigger className="w-[180px] h-8 bg-transparent border-border hover:bg-secondary/50 text-xs font-medium font-mono">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {MODELS.map(m => (
                <SelectItem key={m.id} value={m.id} className="text-xs font-mono">
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button 
            size="icon" 
            className="h-8 w-8 rounded-lg" 
            onClick={handleSubmit}
            disabled={!content.trim() || disabled}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <div className="text-center">
        <span className="text-[10px] text-muted-foreground">
          MaxxTech Agent can make mistakes. Consider verifying important information.
        </span>
      </div>
    </div>
  );
}
