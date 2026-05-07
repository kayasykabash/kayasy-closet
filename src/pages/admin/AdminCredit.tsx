import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Users,
  Clock,
  Settings,
  History,
  Ban,
  ShieldCheck,
} from "lucide-react";

type RepayStatus =
  | "pending"
  | "partial"
  | "paid"
  | "overdue"
  | "suspended"
  | "cleared";

const STATUS_META: Record<
  string,
  { label: string; className: string; icon?: any }
> = {
  paid: { label: "Paid", className: "bg-green-500/10 text-green-600", icon: CheckCircle2 },
  cleared: { label: "Cleared", className: "bg-green-500/10 text-green-600", icon: ShieldCheck },
  partial: { label: "Partial", className: "bg-orange-500/10 text-orange-600", icon: Clock },
  pending: { label: "Pending", className: "bg-amber-500/10 text-amber-600", icon: Clock },
  overdue: { label: "Overdue", className: "bg-destructive/10 text-destructive", icon: AlertTriangle },
  suspended: { label: "Suspended", className: "bg-muted text-muted-foreground", icon: Ban },
};

function deriveStatus(o: any): RepayStatus {
  if (o.payment_status === "paid") return "paid";
  if (o.is_overdue) return "overdue";
  if (Number(o.amount_due) > 0 && Number(o.amount_due) < Number(o.total)) return "partial";
  return "pending";
}

export default function AdminCredit() {
  const qc = useQueryClient();
  const [manageOrder, setManageOrder] = useState<any | null>(null);
  const [historyUser, setHistoryUser] = useState<any | null>(null);
  const [suspendUser, setSuspendUser] = useState<any | null>(null);

  const { data: orders = [] } = useQuery({
    queryKey: ["admin-credit-orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("payment_method", "credit")
        .order("due_date", { ascending: true, nullsFirst: false });
      return data || [];
    },
  });

  const { data: debtors = [] } = useQuery({
    queryKey: ["admin-credit-debtors"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select(
          "user_id, full_name, phone, credit_balance, credit_limit, credit_score, credit_suspended, suspension_reason"
        )
        .or("credit_balance.gt.0,credit_suspended.eq.true")
        .order("credit_balance", { ascending: false });
      return data || [];
    },
  });

  // Profile lookup map for current manage order
  const { data: managedProfile } = useQuery({
    queryKey: ["admin-credit-profile", manageOrder?.user_id],
    enabled: !!manageOrder?.user_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", manageOrder.user_id)
        .maybeSingle();
      return data;
    },
  });

  const refreshOverdue = async () => {
    const { data, error } = await supabase.rpc("mark_overdue_orders");
    if (error) return toast.error(error.message);
    toast.success(`Marked ${data ?? 0} order(s) as overdue`);
    qc.invalidateQueries({ queryKey: ["admin-credit-orders"] });
  };

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["admin-credit-orders"] });
    qc.invalidateQueries({ queryKey: ["admin-credit-debtors"] });
    qc.invalidateQueries({ queryKey: ["admin-credit-profile"] });
  };

  const unpaid = orders.filter((o: any) => o.payment_status !== "paid");
  const overdue = unpaid.filter((o: any) => o.is_overdue);
  const totalOutstanding = unpaid.reduce(
    (s: number, o: any) => s + Number(o.amount_due || o.total || 0),
    0
  );

  const cards = [
    { label: "Credit Orders", value: orders.length, icon: CreditCard, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Outstanding", value: `₦${totalOutstanding.toLocaleString()}`, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Overdue Orders", value: overdue.length, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Debtors", value: debtors.length, icon: Users, color: "text-purple-500", bg: "bg-purple-500/10" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h1 className="font-heading text-xl font-bold">Credit Monitoring (Bashi)</h1>
        <Button size="sm" variant="outline" onClick={refreshOverdue}>
          <Clock className="h-3.5 w-3.5 mr-1" /> Refresh Overdue
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-card border rounded-xl p-4">
            <div className={`h-10 w-10 rounded-lg ${c.bg} flex items-center justify-center mb-2`}>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </div>
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="font-heading text-xl font-bold mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Orders Table */}
      <div className="bg-card border rounded-xl p-4">
        <h3 className="font-heading font-semibold text-sm mb-4">All Credit Orders</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-2 font-medium">Order</th>
                <th className="text-left py-2 font-medium hidden sm:table-cell">Created</th>
                <th className="text-left py-2 font-medium">Due</th>
                <th className="text-left py-2 font-medium">Status</th>
                <th className="text-right py-2 font-medium">Amount</th>
                <th className="text-right py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground">
                    No credit orders
                  </td>
                </tr>
              )}
              {orders.map((o: any) => {
                const status = deriveStatus(o);
                const meta = STATUS_META[status];
                const Icon = meta.icon;
                const overdueRow = status === "overdue";
                return (
                  <tr
                    key={o.id}
                    className={`border-b last:border-0 ${overdueRow ? "bg-destructive/5" : ""}`}
                  >
                    <td className="py-2 font-mono text-xs">#{o.id.slice(0, 8)}</td>
                    <td className="py-2 hidden sm:table-cell">
                      {new Date(o.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-2">
                      {o.due_date ? new Date(o.due_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-2">
                      <Badge className={`${meta.className} gap-1`}>
                        {Icon && <Icon className="h-3 w-3" />} {meta.label}
                      </Badge>
                    </td>
                    <td className="py-2 text-right font-medium">
                      ₦{Number(o.amount_due || o.total).toLocaleString()}
                    </td>
                    <td className="py-2 text-right">
                      <Button size="sm" variant="outline" onClick={() => setManageOrder(o)}>
                        <Settings className="h-3.5 w-3.5 mr-1" /> Manage
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Debtors Table */}
      <div className="bg-card border rounded-xl p-4">
        <h3 className="font-heading font-semibold text-sm mb-4">Users With Outstanding Debt</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-2 font-medium">Customer</th>
                <th className="text-left py-2 font-medium hidden sm:table-cell">Phone</th>
                <th className="text-left py-2 font-medium">Status</th>
                <th className="text-right py-2 font-medium">Balance</th>
                <th className="text-right py-2 font-medium hidden md:table-cell">Limit</th>
                <th className="text-right py-2 font-medium">Score</th>
                <th className="text-right py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {debtors.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-muted-foreground">
                    No outstanding debtors
                  </td>
                </tr>
              )}
              {debtors.map((p: any) => {
                const status: RepayStatus = p.credit_suspended
                  ? "suspended"
                  : Number(p.credit_balance) > 0
                  ? "partial"
                  : "cleared";
                const meta = STATUS_META[status];
                const Icon = meta.icon;
                return (
                  <tr key={p.user_id} className="border-b last:border-0">
                    <td className="py-2">{p.full_name || "—"}</td>
                    <td className="py-2 hidden sm:table-cell">{p.phone || "—"}</td>
                    <td className="py-2">
                      <Badge className={`${meta.className} gap-1`}>
                        {Icon && <Icon className="h-3 w-3" />} {meta.label}
                      </Badge>
                    </td>
                    <td className="py-2 text-right font-medium text-amber-600">
                      ₦{Number(p.credit_balance).toLocaleString()}
                    </td>
                    <td className="py-2 text-right hidden md:table-cell">
                      ₦{Number(p.credit_limit).toLocaleString()}
                    </td>
                    <td className="py-2 text-right">
                      <span
                        className={`font-bold ${
                          p.credit_score < 50 ? "text-destructive" : "text-foreground"
                        }`}
                      >
                        {p.credit_score}
                      </span>
                    </td>
                    <td className="py-2 text-right space-x-1 whitespace-nowrap">
                      <Button size="sm" variant="outline" onClick={() => setHistoryUser(p)}>
                        <History className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant={p.credit_suspended ? "default" : "destructive"}
                        onClick={() => setSuspendUser(p)}
                      >
                        {p.credit_suspended ? (
                          <ShieldCheck className="h-3.5 w-3.5" />
                        ) : (
                          <Ban className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ManageOrderDialog
        order={manageOrder}
        profile={managedProfile}
        onClose={() => setManageOrder(null)}
        onSaved={() => {
          invalidateAll();
          setManageOrder(null);
        }}
      />

      <HistoryDialog user={historyUser} onClose={() => setHistoryUser(null)} />

      <SuspendDialog
        user={suspendUser}
        onClose={() => setSuspendUser(null)}
        onDone={() => {
          invalidateAll();
          setSuspendUser(null);
        }}
      />
    </div>
  );
}

/* -------------------- Manage Order Dialog -------------------- */
function ManageOrderDialog({
  order,
  profile,
  onClose,
  onSaved,
}: {
  order: any | null;
  profile: any | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<RepayStatus>("pending");
  const [amountDue, setAmountDue] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [reference, setReference] = useState<string>("");
  const [confirm, setConfirm] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);

  // Reset on open
  useState(() => {});
  if (order && !saving && status === "pending" && amountDue === "") {
    // initialize once
    setTimeout(() => {
      setStatus(deriveStatus(order));
      setAmountDue(String(order.amount_due ?? order.total ?? ""));
      setDueDate(order.due_date ? order.due_date.slice(0, 10) : "");
      setNotes(order.admin_notes || "");
      setReference("");
      setConfirm(!!order.payment_confirmed);
    }, 0);
  }

  const handleSave = async () => {
    if (!order) return;
    setSaving(true);
    const { error } = await supabase.rpc("admin_update_credit_order", {
      _order_id: order.id,
      _status: status,
      _amount_due: amountDue === "" ? null : Number(amountDue),
      _due_date: dueDate ? new Date(dueDate).toISOString() : null,
      _admin_notes: notes || null,
      _confirm_payment: confirm,
      _payment_reference: reference || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Credit status updated");
    // reset
    setAmountDue("");
    setStatus("pending");
    onSaved();
  };

  const paid = Number(order?.total || 0) - Number(order?.amount_due ?? order?.total ?? 0);

  return (
    <Dialog open={!!order} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Credit Order</DialogTitle>
          <DialogDescription>
            {order && (
              <span className="font-mono text-xs">#{order.id.slice(0, 8)}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {order && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3 bg-muted/30 rounded-lg p-3">
              <div>
                <p className="text-xs text-muted-foreground">Customer</p>
                <p className="font-medium">{profile?.full_name || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="font-medium">{profile?.phone || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Credit</p>
                <p className="font-medium">₦{Number(order.total).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Amount Paid</p>
                <p className="font-medium">₦{paid.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Remaining</p>
                <p className="font-medium text-amber-600">
                  ₦{Number(order.amount_due ?? order.total).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Credit Score</p>
                <p className="font-medium">{profile?.credit_score ?? "—"}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Repayment Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as RepayStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="partial">Partially Paid</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="cleared">Cleared</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Outstanding (₦)</Label>
                <Input
                  type="number"
                  value={amountDue}
                  onChange={(e) => setAmountDue(e.target.value)}
                  disabled={status === "paid" || status === "cleared"}
                />
              </div>
              <div>
                <Label>Due Date</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div>
                <Label>Payment Reference</Label>
                <Input
                  placeholder="Bank txn ref"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>Admin Notes</Label>
              <Textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason / context (visible to admins only)"
              />
            </div>

            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={confirm}
                onChange={(e) => setConfirm(e.target.checked)}
              />
              Mark payment as confirmed by me
            </label>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- History Dialog -------------------- */
function HistoryDialog({
  user,
  onClose,
}: {
  user: any | null;
  onClose: () => void;
}) {
  const { data: history = [] } = useQuery({
    queryKey: ["admin-credit-history", user?.user_id],
    enabled: !!user?.user_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("credit_repayments")
        .select("*")
        .eq("user_id", user.user_id)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  return (
    <Dialog open={!!user} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payment History</DialogTitle>
          <DialogDescription>{user?.full_name || "Customer"}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {history.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No repayments recorded.
            </p>
          )}
          {history.map((h: any) => (
            <div key={h.id} className="border rounded-lg p-3 text-sm flex justify-between">
              <div>
                <p className="font-medium">₦{Number(h.amount).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">
                  {h.payment_method} · {new Date(h.created_at).toLocaleString()}
                </p>
                <p className="text-xs font-mono">{h.transaction_reference}</p>
              </div>
              <Badge
                className={
                  h.fully_paid
                    ? "bg-green-500/10 text-green-600"
                    : "bg-orange-500/10 text-orange-600"
                }
              >
                {h.fully_paid ? "Fully Paid" : "Partial"}
              </Badge>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- Suspend Dialog -------------------- */
function SuspendDialog({
  user,
  onClose,
  onDone,
}: {
  user: any | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const isSuspended = !!user?.credit_suspended;

  const handleConfirm = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_set_credit_suspension", {
      _user_id: user.user_id,
      _suspended: !isSuspended,
      _reason: reason || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(isSuspended ? "Credit access restored" : "Credit access suspended");
    setReason("");
    onDone();
  };

  return (
    <AlertDialog open={!!user} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isSuspended ? "Restore Credit Access?" : "Suspend Credit Access?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isSuspended
              ? `Re-enable credit purchases for ${user?.full_name || "this customer"}.`
              : `Block ${user?.full_name || "this customer"} from making new credit purchases.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {!isSuspended && (
          <div>
            <Label className="text-xs">Reason (optional)</Label>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={busy}>
            {busy ? "..." : isSuspended ? "Restore" : "Suspend"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
