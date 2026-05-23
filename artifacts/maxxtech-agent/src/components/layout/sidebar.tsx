import { Link, useLocation } from "wouter";
import {
  useListConversations,
  useUpdateConversation,
  useDeleteConversation,
} from "@workspace/api-client-react";
import { Plus, MessageSquare, Settings, Pin, MoreVertical, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

export function Sidebar() {
  const [location] = useLocation();
  const { data: conversations, isLoading } = useListConversations();

  const pinned = conversations?.filter((c) => c.pinned) ?? [];
  const recent = conversations?.filter((c) => !c.pinned) ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <span className="font-bold tracking-tight text-sm text-foreground">MaxxTech</span>
        </div>
        <Button asChild variant="secondary" className="w-full justify-start gap-2 h-9 text-sm" data-testid="button-new-chat">
          <Link href="/">
            <Plus className="w-4 h-4" />
            <span className="font-semibold">New Chat</span>
          </Link>
        </Button>
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {isLoading ? (
          <div className="space-y-1.5">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-8 w-full bg-secondary/40 rounded-md" />
            ))}
          </div>
        ) : (
          <>
            {pinned.length > 0 && (
              <div className="space-y-0.5">
                <p className="text-[10px] font-semibold text-muted-foreground px-2 uppercase tracking-widest mb-1.5">
                  Pinned
                </p>
                {pinned.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conv={conv}
                    active={location === `/c/${conv.id}`}
                  />
                ))}
              </div>
            )}
            {recent.length > 0 && (
              <div className="space-y-0.5">
                <p className="text-[10px] font-semibold text-muted-foreground px-2 uppercase tracking-widest mb-1.5">
                  Recent
                </p>
                {recent.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conv={conv}
                    active={location === `/c/${conv.id}`}
                  />
                ))}
              </div>
            )}
            {conversations?.length === 0 && (
              <p className="text-xs text-muted-foreground text-center pt-8 px-4">
                No conversations yet. Start a new chat!
              </p>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 pb-4 pt-3 border-t border-border shrink-0 space-y-1">
        <Button
          asChild
          variant="ghost"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground h-9 text-sm"
        >
          <Link href="/settings">
            <Settings className="w-4 h-4" />
            <span className="font-medium">Settings</span>
          </Link>
        </Button>
        <div className="px-2 pt-2">
          <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
            Built by{" "}
            <span className="text-primary font-semibold">CarlymaxX</span>
            <br />
            Powered by Claude · Gemini · Groq
          </p>
        </div>
      </div>
    </div>
  );
}

function ConversationItem({ conv, active }: { conv: any; active: boolean }) {
  const updateMutation = useUpdateConversation();
  const deleteMutation = useDeleteConversation();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const handleTogglePin = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await updateMutation.mutateAsync({ id: conv.id, data: { pinned: !conv.pinned } });
    queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Delete this conversation?")) {
      await deleteMutation.mutateAsync({ id: conv.id });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      if (active) setLocation("/");
    }
  };

  const timeAgo = (() => {
    try {
      return formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: true });
    } catch {
      return "";
    }
  })();

  return (
    <Link
      href={`/c/${conv.id}`}
      className={`group flex items-center justify-between px-2 py-2 text-xs rounded-md transition-colors cursor-pointer ${
        active
          ? "bg-primary/15 text-primary font-medium border border-primary/20"
          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
      }`}
      data-testid={`link-conversation-${conv.id}`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {conv.pinned ? (
          <Pin className="w-3 h-3 shrink-0 text-primary" />
        ) : (
          <MessageSquare className="w-3 h-3 shrink-0" />
        )}
        <div className="min-w-0">
          <p className="truncate font-medium leading-tight">{conv.title}</p>
          {timeAgo && <p className="text-[10px] text-muted-foreground/60 leading-none mt-0.5">{timeAgo}</p>}
        </div>
      </div>

      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="p-1 hover:bg-background rounded text-muted-foreground hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="w-3 h-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="text-xs">
            <DropdownMenuItem onClick={handleTogglePin} className="text-xs">
              <Pin className="w-3.5 h-3.5 mr-2" />
              {conv.pinned ? "Unpin" : "Pin"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleDelete}
              className="text-xs text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Link>
  );
}
