import React from "react";
import { Link, useLocation } from "wouter";
import { useListConversations, useUpdateConversation, useDeleteConversation } from "@workspace/api-client-react";
import { Plus, MessageSquare, Settings, Pin, MoreVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

export function Sidebar() {
  const [location] = useLocation();
  const { data: conversations, isLoading } = useListConversations();

  const pinned = conversations?.filter((c) => c.pinned) || [];
  const recent = conversations?.filter((c) => !c.pinned) || [];

  return (
    <div className="flex flex-col h-full py-4 px-3">
      <Button asChild variant="secondary" className="w-full justify-start gap-2 mb-6 h-10">
        <Link href="/">
          <Plus className="w-4 h-4" />
          <span className="font-semibold tracking-tight">New Chat</span>
        </Link>
      </Button>

      <div className="flex-1 overflow-y-auto space-y-6 pr-2">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full bg-secondary/50 rounded-md" />
            <Skeleton className="h-9 w-full bg-secondary/50 rounded-md" />
            <Skeleton className="h-9 w-full bg-secondary/50 rounded-md" />
          </div>
        ) : (
          <>
            {pinned.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-muted-foreground px-2 uppercase tracking-wider mb-2">Pinned</h4>
                {pinned.map((conv) => (
                  <ConversationItem key={conv.id} conv={conv} active={location === `/c/${conv.id}`} />
                ))}
              </div>
            )}

            {recent.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-muted-foreground px-2 uppercase tracking-wider mb-2">Recent</h4>
                {recent.map((conv) => (
                  <ConversationItem key={conv.id} conv={conv} active={location === `/c/${conv.id}`} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="pt-4 mt-auto border-t border-border">
        <Button asChild variant="ghost" className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground h-10">
          <Link href="/settings">
            <Settings className="w-4 h-4" />
            <span className="font-semibold tracking-tight">Settings</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}

function ConversationItem({ conv, active }: { conv: any; active: boolean }) {
  const updateMutation = useUpdateConversation();
  const deleteMutation = useDeleteConversation();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();

  const handleTogglePin = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await updateMutation.mutateAsync({ id: conv.id, data: { pinned: !conv.pinned } });
    queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Delete this conversation?")) {
      await deleteMutation.mutateAsync({ id: conv.id });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      if (active) {
        setLocation('/');
      }
    }
  };

  return (
    <Link 
      href={`/c/${conv.id}`}
      className={`group flex items-center justify-between px-2 py-2 text-sm rounded-md transition-colors ${active ? "bg-primary/20 text-primary font-medium" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"}`}
    >
      <div className="flex items-center gap-2 truncate pr-2">
        {conv.pinned ? <Pin className="w-3.5 h-3.5 shrink-0" /> : <MessageSquare className="w-3.5 h-3.5 shrink-0" />}
        <span className="truncate">{conv.title}</span>
      </div>
      
      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1 hover:bg-background rounded text-muted-foreground hover:text-foreground" onClick={e => e.stopPropagation()}>
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={handleTogglePin}>
              <Pin className="w-4 h-4 mr-2" />
              {conv.pinned ? "Unpin" : "Pin"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Link>
  );
}
