import { useEffect } from "react";
import { Bell, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export function NotificationBell() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("notification_logs")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(15);
      return data || [];
    },
  });

  // Trigger reminder generation occasionally (best-effort)
  useEffect(() => {
    if (!user) return;
    supabase.rpc("generate_credit_reminders").then(() => {
      qc.invalidateQueries({ queryKey: ["notifications", user.id] });
    });
  }, [user, qc]);

  const unread = items.filter((i: any) => !i.is_read).length;

  const markAllRead = async () => {
    if (!user || unread === 0) return;
    await supabase.from("notification_logs").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    qc.invalidateQueries({ queryKey: ["notifications", user.id] });
  };

  if (!user) return null;

  return (
    <DropdownMenu onOpenChange={(o) => o && markAllRead()}>
      <DropdownMenuTrigger asChild>
        <button className="p-2 relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <Badge className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px] bg-destructive text-destructive-foreground">
              {unread}
            </Badge>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-semibold">Notifications</span>
          <Link to="/credit" className="text-xs text-primary hover:underline">My Credit</Link>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 && (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">No notifications</div>
          )}
          {items.map((n: any) => {
            const Icon = n.type === "overdue" ? AlertTriangle : n.type === "reminder" ? Clock : CheckCircle2;
            const color = n.type === "overdue" ? "text-destructive" : n.type === "reminder" ? "text-amber-500" : "text-primary";
            return (
              <div key={n.id} className="px-3 py-2 border-b last:border-0 flex gap-2 hover:bg-muted/30">
                <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${color}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-snug">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(n.created_at).toLocaleString()}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="p-2 border-t">
          <Link to="/credit">
            <Button size="sm" variant="outline" className="w-full text-xs">View Credit Wallet</Button>
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
