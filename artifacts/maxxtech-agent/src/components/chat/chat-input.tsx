import { useState, useRef } from "react";
import { Send, Terminal, Globe, HelpCircle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";

export const MODEL_GROUPS = [
  {
    provider: "Claude — Anthropic",
    models: [
      { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
      { id: "claude-opus-4-7", name: "Claude Opus 4.7" },
      { id: "claude-haiku-4-5", name: "Claude Haiku 4.5" },
    ],
  },
  {
    provider: "Gemini — Google",
    models: [
      { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro" },
      { id: "gemini-3-flash-preview", name: "Gemini 3 Flash" },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
    ],
  },
  {
    provider: "OpenRouter — Groq / Meta / DeepSeek",
    models: [
      { id: "meta-llama/llama-4-maverick", name: "Llama 4 Maverick" },
      { id: "meta-llama/llama-4-scout", name: "Llama 4 Scout" },
      { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B" },
      { id: "deepseek/deepseek-r1", name: "DeepSeek R1" },
      { id: "qwen/qwen3-235b-a22b", name: "Qwen 3 235B" },
    ],
  },
];

const ALL_MODELS = MODEL_GROUPS.flatMap((g) => g.models);

const CHIPS = [
  { label: "Run code", icon: Terminal, action: "Write and run this code:\n\n```javascript\n\n```" },
  { label: "Search web", icon: Globe, action: "Search the web for: " },
  { label: "Explain this", icon: HelpCircle, action: "Explain in detail: " },
];

export function ChatInput({
  onSend,
  disabled,
}: {
  onSend: (content: string, model: string) => void;
  disabled?: boolean;
}) {
  const [content, setContent] = useState("");
  const [modelId, setModelId] = useState(MODEL_GROUPS[0].models[0].id);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedModel = ALL_MODELS.find((m) => m.id === modelId) ?? ALL_MODELS[0];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (!content.trim() || disabled) return;
    onSend(content.trim(), modelId);
    setContent("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-col gap-2">
      <div className="flex items-center gap-2 mb-1 px-1 flex-wrap">
        {CHIPS.map((chip) => {
          const Icon = chip.icon;
          return (
            <button
              key={chip.label}
              onClick={() => {
                setContent((prev) => (prev ? `${prev}\n${chip.action}` : chip.action));
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
          className="min-h-[60px] max-h-[200px] w-full resize-none bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-4 pb-14 text-sm leading-relaxed"
          disabled={disabled}
          data-testid="input-message"
        />

        <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between">
          <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={disabled}>
              <button
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-secondary/60 hover:bg-secondary border border-border text-xs font-mono font-medium transition-colors max-w-[220px] truncate"
                data-testid="select-model"
              >
                <span className="truncate">{selectedModel.name}</span>
                <ChevronDown className="w-3 h-3 shrink-0 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
              {MODEL_GROUPS.map((group) => (
                <div key={group.provider}>
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                    {group.provider}
                  </DropdownMenuLabel>
                  <DropdownMenuGroup>
                    {group.models.map((m) => (
                      <DropdownMenuItem
                        key={m.id}
                        onClick={() => setModelId(m.id)}
                        className={`text-xs font-mono ${modelId === m.id ? "text-primary bg-primary/10" : ""}`}
                      >
                        {m.name}
                        {modelId === m.id && <span className="ml-auto text-primary">✓</span>}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            size="icon"
            className="h-8 w-8 rounded-lg shrink-0"
            onClick={handleSubmit}
            disabled={!content.trim() || disabled}
            data-testid="button-send"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="text-center">
        <span className="text-[10px] text-muted-foreground">
          MaxxTech Agent by <span className="text-primary font-semibold">CarlymaxX</span> — AI can make mistakes, always verify critical information.
        </span>
      </div>
    </div>
  );
}
