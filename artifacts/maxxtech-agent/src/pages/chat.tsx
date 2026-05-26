import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import {
  useListMessages, useGetConversation, useCreateConversation,
  getListMessagesQueryKey, getListConversationsQueryKey,
} from "@workspace/api-client-react";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ChatInput, type AttachedImage, IMAGE_GEN_MODELS } from "@/components/chat/chat-input";
import { Loader2, Zap, ArrowDown } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface StreamingMessage {
  role: "assistant";
  content: string;
  isStreaming: boolean;
  images?: string[];
}

export function ChatPage() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const isNew = !params.id;
  const conversationId = isNew ? undefined : parseInt(params.id as string, 10);

  const { data: conversation, isLoading: isLoadingConv } = useGetConversation(
    conversationId!,
    { query: { enabled: !!conversationId, queryKey: ["/api/conversations", conversationId] } }
  );
  const { data: messages, isLoading: isLoadingMessages } = useListMessages(
    conversationId!,
    { query: { enabled: !!conversationId, queryKey: getListMessagesQueryKey(conversationId!) } }
  );

  const createConvMutation = useCreateConversation();
  const queryClient = useQueryClient();

  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  // Smart scroll: only auto-scroll if user is near the bottom
  const scrollRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior });
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isNearBottom = distanceFromBottom < 120;
    setUserScrolledUp(!isNearBottom);
    setShowScrollBtn(!isNearBottom && scrollHeight > clientHeight + 200);
  }, []);

  // Only auto-scroll when streaming starts OR when near the bottom
  useEffect(() => {
    if (!userScrolledUp) scrollToBottom("smooth");
  }, [streamingMessage?.content, userScrolledUp, scrollToBottom]);

  // Always scroll to bottom when new messages load from DB
  useEffect(() => {
    if (messages && !userScrolledUp) scrollToBottom("instant");
  }, [messages, userScrolledUp, scrollToBottom]);

  // Scroll to bottom when generation starts
  useEffect(() => {
    if (isGenerating) {
      setUserScrolledUp(false);
      scrollToBottom("smooth");
    }
  }, [isGenerating, scrollToBottom]);

  const handleSend = useCallback(async (content: string, model: string, images?: AttachedImage[]) => {
    setIsGenerating(true);
    setStreamingMessage(null);
    setGeneratedImage(null);
    setUserScrolledUp(false);
    let targetId = conversationId;

    try {
      if (!targetId) {
        const newConv = await createConvMutation.mutateAsync({
          data: {
            title: content.substring(0, 50) + (content.length > 50 ? "..." : ""),
            model,
          },
        });
        targetId = newConv.id;
        setLocation(`/c/${newConv.id}`);
        await new Promise((r) => setTimeout(r, 50));
      }

      const abort = new AbortController();
      abortRef.current = abort;

      // Build request body
      const body: any = { content, model };
      if (images && images.length > 0) {
        body.images = images.map((img) => ({
          data: img.dataUrl.split(",")[1], // strip data:image/...;base64,
          mimeType: img.mimeType,
        }));
      }

      setStreamingMessage({ role: "assistant", content: "", isStreaming: true });

      const response = await fetch(`/api/conversations/${targetId}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abort.signal,
      });

      if (!response.ok || !response.body) throw new Error(`Stream failed: ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const event = JSON.parse(raw) as {
              content?: string;
              imageUrl?: string;
              done?: boolean;
              error?: string;
            };
            if (event.error) throw new Error(event.error);
            if (event.content) {
              accumulated += event.content;
              setStreamingMessage({ role: "assistant", content: accumulated, isStreaming: true });
            }
            if (event.imageUrl) {
              setGeneratedImage(event.imageUrl);
              setStreamingMessage({ role: "assistant", content: "Here's the generated image:", isStreaming: false });
            }
            if (event.done) {
              setStreamingMessage(null);
              await queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(targetId!) });
              await queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setStreamingMessage({
          role: "assistant",
          content: `Error: ${(err as Error).message}`,
          isStreaming: false,
        });
      }
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  }, [conversationId, createConvMutation, queryClient, setLocation]);

  const allMessages = [
    ...(messages ?? []),
    ...(streamingMessage
      ? [{
          id: -1, conversationId: conversationId ?? -1,
          role: streamingMessage.role, content: streamingMessage.content,
          toolCalls: null, createdAt: new Date().toISOString(),
          isStreaming: streamingMessage.isStreaming,
        }]
      : []),
  ];

  return (
    <div className="flex flex-col h-full w-full max-w-5xl mx-auto relative bg-background">
      {!isNew && (
        <div className="h-14 border-b border-border flex items-center px-4 sm:px-6 shrink-0 bg-background/95 backdrop-blur z-10 sticky top-0">
          {isLoadingConv ? (
            <div className="h-5 w-48 bg-secondary rounded animate-pulse" />
          ) : (
            <h1 className="font-semibold text-foreground tracking-tight flex items-center gap-2 truncate text-sm sm:text-base">
              <span className="text-muted-foreground font-normal">Chat /</span>{" "}
              <span className="truncate">{conversation?.title}</span>
            </h1>
          )}
        </div>
      )}

      {/* Messages — smart scroll container */}
      <div
        className="flex-1 overflow-y-auto p-4 sm:p-6 sm:px-8 relative"
        ref={scrollRef}
        onScroll={handleScroll}
      >
        {isNew ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-500">
            <div className="w-20 h-20 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center shadow-lg shadow-primary/10">
              <Zap className="w-10 h-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">How can I help you today?</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                MaxxTech Agent by <span className="text-primary font-semibold">CarlymaxX</span> — Claude · Gemini · Groq<br />
                Code, search, generate images, analyze files and more.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 pb-6 max-w-4xl mx-auto">
            {isLoadingMessages ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              allMessages.map((msg, i) => (
                <MessageBubble
                  key={msg.id === -1 ? `streaming-${i}` : msg.id}
                  message={msg}
                  isStreaming={"isStreaming" in msg ? (msg.isStreaming as boolean) : false}
                  onEdit={undefined}
                />
              ))
            )}

            {/* Generated image display */}
            {generatedImage && (
              <div className="flex flex-col items-start gap-2">
                <img
                  src={generatedImage}
                  alt="Generated"
                  className="rounded-xl max-w-md w-full border border-border shadow-lg"
                />
                <a
                  href={generatedImage}
                  download="maxxtech-generated.png"
                  className="text-xs text-primary underline"
                >
                  Download image
                </a>
              </div>
            )}

            {isGenerating && !streamingMessage && (
              <div className="flex items-center gap-3 text-muted-foreground text-sm pl-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex gap-1.5 items-center bg-secondary/50 px-3 py-2 rounded-full border border-border">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  <span className="ml-1 font-medium text-xs uppercase tracking-widest text-primary">Thinking</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scroll-to-bottom button */}
      {showScrollBtn && (
        <button
          onClick={() => { setUserScrolledUp(false); scrollToBottom("smooth"); }}
          className="absolute bottom-36 right-6 z-20 flex items-center gap-1.5 px-3 py-2 rounded-full bg-card border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-secondary shadow-lg transition-all animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <ArrowDown className="w-3.5 h-3.5" />
          Scroll to bottom
        </button>
      )}

      {/* Input */}
      <div className="p-3 sm:p-6 bg-gradient-to-t from-background via-background to-transparent pt-6 shrink-0">
        <ChatInput onSend={handleSend} disabled={isGenerating} />
      </div>
    </div>
  );
}
