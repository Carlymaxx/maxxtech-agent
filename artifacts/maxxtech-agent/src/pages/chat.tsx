import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import {
  useListMessages,
  useGetConversation,
  useCreateConversation,
  getListMessagesQueryKey,
  getListConversationsQueryKey,
} from "@workspace/api-client-react";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ChatInput } from "@/components/chat/chat-input";
import { Loader2, Zap } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface StreamingMessage {
  role: "assistant";
  content: string;
  isStreaming: boolean;
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
    {
      query: {
        enabled: !!conversationId,
        queryKey: getListMessagesQueryKey(conversationId!),
      },
    }
  );

  const createConvMutation = useCreateConversation();
  const queryClient = useQueryClient();

  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, streamingMessage?.content, isGenerating]);

  const handleSend = useCallback(async (content: string, model: string) => {
    setIsGenerating(true);
    setStreamingMessage(null);
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
        // Small delay so the route change settles before we start streaming
        await new Promise((r) => setTimeout(r, 50));
      }

      const abort = new AbortController();
      abortRef.current = abort;

      setStreamingMessage({ role: "assistant", content: "", isStreaming: true });

      const response = await fetch(`/api/conversations/${targetId}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, model }),
        signal: abort.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Stream failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          try {
            const event = JSON.parse(raw) as {
              content?: string;
              done?: boolean;
              error?: string;
            };

            if (event.error) {
              throw new Error(event.error);
            }

            if (event.content) {
              accumulated += event.content;
              setStreamingMessage({ role: "assistant", content: accumulated, isStreaming: true });
            }

            if (event.done) {
              setStreamingMessage(null);
              // Invalidate so the real persisted messages load
              await queryClient.invalidateQueries({
                queryKey: getListMessagesQueryKey(targetId!),
              });
              await queryClient.invalidateQueries({
                queryKey: getListConversationsQueryKey(),
              });
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setStreamingMessage({
          role: "assistant",
          content: `Something went wrong: ${(err as Error).message}`,
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
      ? [{ id: -1, conversationId: conversationId ?? -1, role: streamingMessage.role, content: streamingMessage.content, toolCalls: null, createdAt: new Date().toISOString(), isStreaming: streamingMessage.isStreaming }]
      : []),
  ];

  return (
    <div className="flex flex-col h-full w-full max-w-5xl mx-auto relative bg-background">
      {!isNew && (
        <div className="h-14 border-b border-border flex items-center px-6 shrink-0 bg-background/95 backdrop-blur z-10 sticky top-0">
          {isLoadingConv ? (
            <div className="h-5 w-48 bg-secondary rounded animate-pulse" />
          ) : (
            <h1 className="font-semibold text-foreground tracking-tight flex items-center gap-2">
              <span className="text-muted-foreground font-normal text-sm">Chat /</span>{" "}
              {conversation?.title}
            </h1>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 sm:px-8" ref={scrollRef}>
        {isNew ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-500">
            <div className="w-20 h-20 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center shadow-lg shadow-primary/10">
              <Zap className="w-10 h-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">How can I help you today?</h2>
              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                I'm MaxxTech Agent — powered by Claude. I can write and run code, search the
                web, and help with any tech or IT task.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 pb-20 max-w-4xl mx-auto">
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
                />
              ))
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

      <div className="p-4 sm:p-6 bg-gradient-to-t from-background via-background to-transparent pt-8 shrink-0">
        <ChatInput onSend={handleSend} disabled={isGenerating} />
      </div>
    </div>
  );
}
