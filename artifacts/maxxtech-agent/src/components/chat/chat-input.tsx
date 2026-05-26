import { useState, useRef, useCallback } from "react";
import {
  Send, Terminal, Globe, HelpCircle, ChevronDown,
  Plus, X, Sparkles, Mic, MicOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { useVoiceInput } from "@/hooks/use-voice-input";

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
      { id: "gemini-2.5-flash-image", name: "Gemini Image Gen ✨" },
    ],
  },
  {
    provider: "OpenRouter — Meta / DeepSeek / Qwen",
    models: [
      { id: "meta-llama/llama-4-maverick", name: "Llama 4 Maverick" },
      { id: "meta-llama/llama-4-scout", name: "Llama 4 Scout" },
      { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B" },
      { id: "deepseek/deepseek-r1", name: "DeepSeek R1" },
      { id: "qwen/qwen3-235b-a22b", name: "Qwen 3 235B" },
    ],
  },
];

export const IMAGE_GEN_MODELS = ["gemini-2.5-flash-image", "gemini-3-pro-image-preview"];

const ALL_MODELS = MODEL_GROUPS.flatMap((g) => g.models);

const CHIPS = [
  { label: "Run code", icon: Terminal, action: "Write and run this code:\n\n```javascript\n\n```" },
  { label: "Search web", icon: Globe, action: "Search the web for: " },
  { label: "Generate image", icon: Sparkles, action: "Generate an image of: ", modelSwitch: "gemini-2.5-flash-image" },
  { label: "Explain this", icon: HelpCircle, action: "Explain in detail: " },
];

export interface AttachedImage {
  dataUrl: string;
  mimeType: string;
  name: string;
}

interface ChatInputProps {
  onSend: (content: string, model: string, images?: AttachedImage[]) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [content, setContent] = useState("");
  const [modelId, setModelId] = useState(MODEL_GROUPS[0].models[0].id);
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedModel = ALL_MODELS.find((m) => m.id === modelId) ?? ALL_MODELS[0];
  const isImageGen = IMAGE_GEN_MODELS.includes(modelId);

  /* ── Voice input ─────────────────────────────────────────────── */
  const handleVoiceTranscript = useCallback((text: string) => {
    setContent((prev) => prev ? `${prev} ${text}` : text);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, []);

  const { isListening, startListening, stopListening, supported: voiceSupported, error: voiceError } =
    useVoiceInput(handleVoiceTranscript);

  /* ── Handlers ────────────────────────────────────────────────── */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const handleSubmit = () => {
    if ((!content.trim() && attachedImages.length === 0) || disabled) return;
    const text = content.trim() || "What's in this image?";
    onSend(text, modelId, attachedImages.length > 0 ? attachedImages : undefined);
    setContent("");
    setAttachedImages([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setAttachedImages((prev) => [...prev, { dataUrl, mimeType: file.type, name: file.name }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    Array.from(e.clipboardData.items).forEach((item) => {
      if (!item.type.startsWith("image/")) return;
      const file = item.getAsFile();
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setAttachedImages((prev) => [...prev, { dataUrl, mimeType: file.type, name: "pasted-image.png" }]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const toggleVoice = () => {
    if (isListening) stopListening();
    else startListening();
  };

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-col gap-2">
      {/* Quick chips */}
      <div className="flex items-center gap-2 mb-1 px-1 flex-wrap">
        {CHIPS.map((chip) => {
          const Icon = chip.icon;
          return (
            <button
              key={chip.label}
              onClick={() => {
                if (chip.modelSwitch) setModelId(chip.modelSwitch);
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

      {/* Image previews */}
      {attachedImages.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1">
          {attachedImages.map((img, idx) => (
            <div key={idx} className="relative group">
              <img src={img.dataUrl} alt={img.name} className="h-20 w-20 object-cover rounded-xl border border-border shadow-sm" />
              <button
                onClick={() => setAttachedImages((prev) => prev.filter((_, i) => i !== idx))}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Voice error */}
      {voiceError && (
        <p className="text-xs text-destructive px-1">{voiceError}</p>
      )}

      {/* Main input box */}
      <div className="relative flex flex-col bg-card border border-border rounded-2xl shadow-sm focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all overflow-hidden">
        {isImageGen && (
          <div className="flex items-center gap-1.5 px-4 pt-3 pb-0">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs text-primary font-medium">Image generation mode</span>
          </div>
        )}

        {/* Live transcription indicator */}
        {isListening && (
          <div className="flex items-center gap-2 px-4 pt-3 pb-0">
            <span className="flex gap-1 items-center">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: "300ms" }} />
            </span>
            <span className="text-xs text-red-500 font-medium">Listening… speak now</span>
          </div>
        )}

        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={
            isListening
              ? "Listening — speak now..."
              : isImageGen
              ? "Describe the image you want to generate..."
              : attachedImages.length > 0
              ? "Ask about this image, or add a message..."
              : "Ask anything… (paste or attach images, or speak)"
          }
          className="min-h-[60px] max-h-[200px] w-full resize-none bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-4 pb-14 text-sm leading-relaxed"
          disabled={disabled}
          data-testid="input-message"
        />

        <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {/* Attach image */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              title="Attach image"
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary/60 hover:bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors shrink-0 disabled:opacity-40"
            >
              <Plus className="w-4 h-4" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />

            {/* Voice button */}
            {voiceSupported && (
              <button
                onClick={toggleVoice}
                disabled={disabled}
                title={isListening ? "Stop listening" : "Voice input"}
                className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-all shrink-0 disabled:opacity-40 ${
                  isListening
                    ? "bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30"
                    : "bg-secondary/60 hover:bg-secondary border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}

            {/* Model selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild disabled={disabled}>
                <button className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-secondary/60 hover:bg-secondary border border-border text-xs font-mono font-medium transition-colors max-w-[190px] truncate">
                  <span className="truncate">{selectedModel.name}</span>
                  <ChevronDown className="w-3 h-3 shrink-0 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
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
          </div>

          <Button
            size="icon"
            className="h-8 w-8 rounded-xl shrink-0"
            onClick={handleSubmit}
            disabled={(!content.trim() && attachedImages.length === 0) || disabled}
            data-testid="button-send"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="text-center">
        <span className="text-[10px] text-muted-foreground/70">
          MaxxTech Agent by <span className="text-primary font-semibold">CarlymaxX</span> — AI can make mistakes, verify critical information.
        </span>
      </div>
    </div>
  );
}
