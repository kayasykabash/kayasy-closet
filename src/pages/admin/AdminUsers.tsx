import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, Ban, CheckCircle, ShieldCheck, CreditCard } from "lucide-react";
import { useState } from "react";

export default function AdminUsers() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [creditUser, setCreditUser] = useState<any>(null);

  const { data: users = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const rolesByUser: Record<string, string[]> = {};
      (rolesRes.data || []).forEach(r => {
        rolesByUser[r.user_id] = [...(rolesByUser[r.user_id] || []), r.role as string];
      });
      return (profilesRes.data || []).map((p: any) => ({
        ...p,
        roles: rolesByUser[p.user_id] || ["user"],
      }));
    },
  });

  const toggleBlock = useMutation({
    mutationFn: async ({ userId, blocked }: { userId: string; blocked: boolean }) => {
      const { error } = await supabase.from("profiles").update({ is_blocked: blocked }).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("User updated"); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateCredit = useMutation({
    mutationFn: async ({ userId, credit_limit, credit_approved, credit_balance }: any) => {
      const updates: any = {};
      if (credit_limit !== undefined) updates.credit_limit = credit_limit;
      if (credit_approved !== undefined) updates.credit_approved = credit_approved;
      if (credit_balance !== undefined) updates.credit_balance = credit_balance;
      const { error } = await supabase.from("profiles").update(updates).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Credit settings updated");
      setCreditUser(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = users.filter((u: any) =>
    (u.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
    u.user_id?.toLowerCase().includes(search.toLowerCase())
  );

  const creditUsers = users.filter((u: any) => u.credit_approved);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold">Users ({users.length})</h1>
          <p className="text-xs text-muted-foreground">{creditUsers.length} approved for credit</p>
        </div>
        <div className="relative w-full sm:w-60">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">User</th>
                <th className="text-left p-3 font-medium hidden sm:table-cell">Role</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Credit</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-right p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u: any) => {
                const isAdmin = u.roles?.includes("admin");
                return (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-primary">
                            {(u.full_name || "U")[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{u.full_name || "No name"}</p>
                          <p className="text-xs text-muted-foreground truncate">{u.phone || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 hidden sm:table-cell">
                      {isAdmin ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                          <ShieldCheck className="h-3 w-3" /> Admin
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">User</span>
                      )}
                    </td>
                    <td className="p-3 hidden md:table-cell text-xs">
                      {u.credit_approved ? (
                        <div className="space-y-0.5">
                          <div>
                            <span className="text-green-600 font-medium">₦{Number(u.credit_balance || 0).toLocaleString()}</span>
                            <span className="text-muted-foreground"> / ₦{Number(u.credit_limit || 0).toLocaleString()}</span>
                          </div>
                          <div className={`text-[10px] font-bold ${
                            (u.credit_score ?? 100) >= 75 ? "text-green-600" :
                            (u.credit_score ?? 100) >= 50 ? "text-amber-500" : "text-destructive"
                          }`}>Score: {u.credit_score ?? 100}/100</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.is_blocked ? "bg-destructive/10 text-destructive" : "bg-green-500/10 text-green-600"
                      }`}>
                        {u.is_blocked ? "Blocked" : "Active"}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setCreditUser(u)}>
                          <CreditCard className="h-3.5 w-3.5" />
                        </Button>
                        {!isAdmin && (
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => toggleBlock.mutate({ userId: u.user_id, blocked: !u.is_blocked })}
                          >
                            {u.is_blocked ? (
                              <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <Ban className="h-3.5 w-3.5 text-destructive" />
                            )}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Credit dialog */}
      <Dialog open={!!creditUser} onOpenChange={open => !open && setCreditUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Credit Settings — {creditUser?.full_name || "User"}</DialogTitle></DialogHeader>
          {creditUser && <CreditForm user={creditUser} onSave={updateCredit.mutate} pending={updateCredit.isPending} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreditForm({ user, onSave, pending }: any) {
  const [approved, setApproved] = useState(!!user.credit_approved);
  const [limit, setLimit] = useState(String(user.credit_limit || 0));
  const [balance, setBalance] = useState(String(user.credit_balance || 0));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-3 rounded-lg border">
        <div>
          <p className="font-medium text-sm">Approve for Credit (Bashi)</p>
          <p className="text-xs text-muted-foreground">Allow buy-now-pay-later</p>
        </div>
        <Switch checked={approved} onCheckedChange={setApproved} />
      </div>
      <div>
        <Label>Credit Limit (₦)</Label>
        <Input type="number" value={limit} onChange={e => setLimit(e.target.value)} disabled={!approved} />
      </div>
      <div>
        <Label>Outstanding Balance (₦)</Label>
        <Input type="number" value={balance} onChange={e => setBalance(e.target.value)} />
        <p className="text-xs text-muted-foreground mt-1">Set to 0 when customer pays back</p>
      </div>
      <Button
        className="w-full"
        disabled={pending}
        onClick={() => onSave({
          userId: user.user_id,
          credit_approved: approved,
          credit_limit: parseFloat(limit) || 0,
          credit_balance: parseFloat(balance) || 0,
        })}
      >
        {pending ? "Saving..." : "Save Credit Settings"}
      </Button>
    </div>
  );
}
