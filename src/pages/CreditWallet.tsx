import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CreditCard, Wallet, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function CreditWallet() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [payOrder, setPayOrder] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("transfer");

  const { data } = useQuery({
    queryKey: ["credit-wallet", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: profile }, { data: orders }] = await Promise.all([
        supabase.from("profiles").select("credit_balance, credit_limit, credit_score, credit_approved").eq("user_id", user!.id).maybeSingle(),
        supabase.from("orders").select("*").eq("user_id", user!.id).eq("payment_method", "credit").order("due_date", { ascending: true, nullsFirst: false }),
      ]);
      const all = orders || [];
      const unpaid = all.filter(o => o.payment_status !== "paid");
      const overdue = unpaid.filter(o => o.is_overdue);
      const totalOutstanding = unpaid.reduce((s, o) => s + Number(o.amount_due || o.total), 0);
      const overdueAmount = overdue.reduce((s, o) => s + Number(o.amount_due || o.total), 0);
      const totalUsed = all.reduce((s, o) => s + Number(o.total), 0);
      return { profile, all, unpaid, overdue, totalOutstanding, overdueAmount, totalUsed };
    },
  });

  const repay = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      if (!payOrder) throw new Error("No order selected");
      if (!amt || amt <= 0) throw new Error("Enter a valid amount");
      const { data: result, error } = await supabase.rpc("repay_credit_order", {
        _order_id: payOrder.id,
        _amount: amt,
        _method: method,
      });
      if (error) throw error;
      return result;
    },
    onSuccess: (res: any) => {
      toast.success(res?.fully_paid ? "Order fully paid ✅" : `Paid ₦${res?.amount_paid?.toLocaleString?.() || amount}`);
      setPayOrder(null);
      setAmount("");
      qc.invalidateQueries({ queryKey: ["credit-wallet"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e: any) => toast.error(e.message || "Payment failed"),
  });

  if (!user) return <Navigate to="/auth" replace />;

  const profile = data?.profile;
  const limit = Number(profile?.credit_limit || 0);
  const balance = Number(profile?.credit_balance || 0);
  const available = Math.max(0, limit - balance);

  return (
    <Layout>
      <div className="container max-w-5xl py-6 space-y-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">My Credit Wallet</h1>
          <p className="text-sm text-muted-foreground">Manage your Bashi (credit) account and repay outstanding orders</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat icon={Wallet} label="Outstanding" value={`₦${(data?.totalOutstanding || 0).toLocaleString()}`} color="text-amber-500" bg="bg-amber-500/10" />
          <Stat icon={AlertTriangle} label="Overdue" value={`₦${(data?.overdueAmount || 0).toLocaleString()}`} color="text-destructive" bg="bg-destructive/10" />
          <Stat icon={CreditCard} label="Credit Limit" value={`₦${limit.toLocaleString()}`} color="text-blue-500" bg="bg-blue-500/10" />
          <Stat icon={CheckCircle2} label="Available" value={`₦${available.toLocaleString()}`} color="text-green-600" bg="bg-green-500/10" />
        </div>

        {data?.overdue && data.overdue.length > 0 && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-destructive text-sm">You have {data.overdue.length} overdue payment(s)</p>
              <p className="text-xs text-muted-foreground mt-0.5">Settle overdue balances to avoid further credit restrictions.</p>
            </div>
          </div>
        )}

        <div className="bg-card border rounded-xl p-4">
          <h2 className="font-heading font-semibold mb-3">Credit Orders</h2>
          {(!data?.all || data.all.length === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-6">No credit orders yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs">
                    <th className="text-left py-2">Order</th>
                    <th className="text-left py-2">Due Date</th>
                    <th className="text-right py-2">Amount Due</th>
                    <th className="text-left py-2">Status</th>
                    <th className="text-right py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.all.map((o: any) => {
                    const paid = o.payment_status === "paid";
                    const due = Number(o.amount_due || o.total);
                    return (
                      <tr key={o.id} className={`border-b last:border-0 ${o.is_overdue && !paid ? "bg-destructive/5" : ""}`}>
                        <td className="py-2 font-mono text-xs">#{o.id.slice(0, 8)}</td>
                        <td className="py-2 text-xs">{o.due_date ? new Date(o.due_date).toLocaleDateString() : "—"}</td>
                        <td className="py-2 text-right font-medium">₦{due.toLocaleString()}</td>
                        <td className="py-2">
                          {paid ? (
                            <Badge className="bg-green-500/10 text-green-600 gap-1 text-[10px]"><CheckCircle2 className="h-3 w-3" /> Paid</Badge>
                          ) : o.is_overdue ? (
                            <Badge className="bg-destructive/10 text-destructive gap-1 text-[10px]"><AlertTriangle className="h-3 w-3" /> Overdue</Badge>
                          ) : (
                            <Badge className="bg-amber-500/10 text-amber-600 gap-1 text-[10px]"><Clock className="h-3 w-3" /> Pending</Badge>
                          )}
                        </td>
                        <td className="py-2 text-right">
                          {!paid && (
                            <Button size="sm" onClick={() => { setPayOrder(o); setAmount(String(due)); }}>
                              Pay Now
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!payOrder} onOpenChange={(o) => !o && setPayOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Repay Credit Order</DialogTitle>
          </DialogHeader>
          {payOrder && (
            <div className="space-y-3">
              <div className="bg-muted/30 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Order</span><span className="font-mono text-xs">#{payOrder.id.slice(0,8)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Outstanding</span><span className="font-semibold">₦{Number(payOrder.amount_due || payOrder.total).toLocaleString()}</span></div>
                {payOrder.due_date && <div className="flex justify-between"><span className="text-muted-foreground">Due</span><span>{new Date(payOrder.due_date).toLocaleDateString()}</span></div>}
              </div>
              <div className="space-y-2">
                <Label>Amount to pay (₦)</Label>
                <Input type="number" min={1} max={Number(payOrder.amount_due || payOrder.total)} value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Payment method</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="pos">POS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">An admin will confirm cash/transfer payments. Your credit balance will update automatically.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOrder(null)}>Cancel</Button>
            <Button onClick={() => repay.mutate()} disabled={repay.isPending}>
              {repay.isPending ? "Processing..." : "Confirm Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function Stat({ icon: Icon, label, value, color, bg }: any) {
  return (
    <div className="bg-card border rounded-xl p-4">
      <div className={`h-9 w-9 rounded-lg ${bg} flex items-center justify-center mb-2`}>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}
