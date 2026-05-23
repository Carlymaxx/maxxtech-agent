import React, { useState, useRef, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useListMessages, useGetConversation, useSendMessage, useCreateConversation } from "@workspace/api-client-react";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ChatInput } from "@/components/chat/chat-input";
import { Loader2, Zap } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export function ChatPage() {
  const params = useParams();
  const [location, setLocation] = useLocation();
  const isNew = !params.id;
  const conversationId = isNew ? undefined : parseInt(params.id as string, 10);

  const { data: conversation, isLoading: isLoadingConv } = useGetConversation(conversationId!, {
    query: { enabled: !!conversationId, queryKey: ['/api/conversations', conversationId] }
  });

  const { data: messages, isLoading: isLoadingMessages } = useListMessages(conversationId!, {
    query: { enabled: !!conversationId, queryKey: ['/api/conversations', conversationId, 'messages'] }
  });

  const createConvMutation = useCreateConversation();
  const sendMessageMutation = useSendMessage();
  const queryClient = useQueryClient();

  const [isGenerating, setIsGenerating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isGenerating]);

  const handleSend = async (content: string, model: string) => {
    setIsGenerating(true);
    let targetId = conversationId;

    if (!targetId) {
      const newConv = await createConvMutation.mutateAsync({
        data: { title: content.substring(0, 40) + (content.length > 40 ? "..." : ""), model }
      });
      targetId = newConv.id;
      // We push state so that the input doesn't lose focus
      setLocation(`/c/${newConv.id}`);
    }

    try {
      await sendMessageMutation.mutateAsync({
        id: targetId!,
        data: { content }
      });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations', targetId, 'messages'] });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-5xl mx-auto relative bg-background">
      {/* Header for loaded conversation */}
      {!isNew && (
        <div className="h-14 border-b border-border flex items-center px-6 shrink-0 bg-background/95 backdrop-blur z-10 sticky top-0">
          {isLoadingConv ? (
            <div className="h-5 w-48 bg-secondary rounded animate-pulse" />
          ) : (
            <h1 className="font-semibold text-foreground tracking-tight flex items-center gap-2">
              <span className="text-muted-foreground font-normal text-sm">Chat /</span> {conversation?.title}
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
                I'm the MaxxTech Agent, your personal command-center AI. I can search the web, run code, and help you solve complex technical problems.
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
              messages?.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))
            )}
            {isGenerating && (
              <div className="flex items-center gap-3 text-muted-foreground text-sm pl-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex gap-1.5 items-center bg-secondary/50 px-3 py-2 rounded-full border border-border">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span className="ml-1 font-medium text-xs uppercase tracking-widest text-primary">Generating</span>
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
