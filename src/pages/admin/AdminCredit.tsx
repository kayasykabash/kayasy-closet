import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CreditCard, AlertTriangle, CheckCircle2, Users, Clock } from "lucide-react";

export default function AdminCredit() {
  const qc = useQueryClient();

  const { data: orders = [] } = useQuery({
    queryKey: ["admin-credit-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, profiles!inner(user_id, full_name, phone, credit_balance, credit_limit, credit_score)")
        .eq("payment_method", "credit")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) {
        // fallback without join if FK not present
        const { data: o2 } = await supabase.from("orders").select("*").eq("payment_method", "credit").order("due_date", { ascending: true, nullsFirst: false });
        return o2 || [];
      }
      return data || [];
    },
  });

  const { data: debtors = [] } = useQuery({
    queryKey: ["admin-credit-debtors"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone, credit_balance, credit_limit, credit_score")
        .gt("credit_balance", 0)
        .order("credit_balance", { ascending: false });
      return data || [];
    },
  });

  const markPaid = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from("orders")
        .update({ payment_status: "paid", is_overdue: false })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marked as paid");
      qc.invalidateQueries({ queryKey: ["admin-credit-orders"] });
      qc.invalidateQueries({ queryKey: ["admin-credit-debtors"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const refreshOverdue = async () => {
    const { data, error } = await supabase.rpc("mark_overdue_orders");
    if (error) return toast.error(error.message);
    toast.success(`Marked ${data ?? 0} order(s) as overdue`);
    qc.invalidateQueries({ queryKey: ["admin-credit-orders"] });
  };

  const unpaid = orders.filter((o: any) => o.payment_status !== "paid");
  const overdue = unpaid.filter((o: any) => o.is_overdue);
  const totalOutstanding = unpaid.reduce((s: number, o: any) => s + Number(o.amount_due || o.total || 0), 0);

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
        {cards.map(c => (
          <div key={c.label} className="bg-card border rounded-xl p-4">
            <div className={`h-10 w-10 rounded-lg ${c.bg} flex items-center justify-center mb-2`}>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </div>
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="font-heading text-xl font-bold mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border rounded-xl p-4">
        <h3 className="font-heading font-semibold text-sm mb-4">All Credit Orders</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-2 font-medium">Order</th>
                <th className="text-left py-2 font-medium">Created</th>
                <th className="text-left py-2 font-medium">Due Date</th>
                <th className="text-left py-2 font-medium">Status</th>
                <th className="text-right py-2 font-medium">Amount</th>
                <th className="text-right py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No credit orders</td></tr>
              )}
              {orders.map((o: any) => {
                const isPaid = o.payment_status === "paid";
                const overdueRow = o.is_overdue && !isPaid;
                return (
                  <tr key={o.id} className={`border-b last:border-0 ${overdueRow ? "bg-destructive/5" : ""}`}>
                    <td className="py-2 font-mono text-xs">#{o.id.slice(0, 8)}</td>
                    <td className="py-2">{new Date(o.created_at).toLocaleDateString()}</td>
                    <td className="py-2">{o.due_date ? new Date(o.due_date).toLocaleDateString() : "—"}</td>
                    <td className="py-2">
                      {isPaid ? (
                        <Badge className="bg-green-500/10 text-green-600 gap-1"><CheckCircle2 className="h-3 w-3" /> Paid</Badge>
                      ) : overdueRow ? (
                        <Badge className="bg-destructive/10 text-destructive gap-1"><AlertTriangle className="h-3 w-3" /> Overdue</Badge>
                      ) : (
                        <Badge className="bg-amber-500/10 text-amber-600 gap-1"><Clock className="h-3 w-3" /> Pending</Badge>
                      )}
                    </td>
                    <td className="py-2 text-right font-medium">₦{Number(o.amount_due || o.total).toLocaleString()}</td>
                    <td className="py-2 text-right">
                      {!isPaid && (
                        <Button size="sm" variant="outline" onClick={() => markPaid.mutate(o.id)} disabled={markPaid.isPending}>
                          Mark Paid
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-card border rounded-xl p-4">
        <h3 className="font-heading font-semibold text-sm mb-4">Users With Outstanding Debt</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-2 font-medium">Customer</th>
                <th className="text-left py-2 font-medium">Phone</th>
                <th className="text-right py-2 font-medium">Balance</th>
                <th className="text-right py-2 font-medium">Limit</th>
                <th className="text-right py-2 font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {debtors.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No outstanding debtors</td></tr>
              )}
              {debtors.map((p: any) => (
                <tr key={p.user_id} className="border-b last:border-0">
                  <td className="py-2">{p.full_name || "—"}</td>
                  <td className="py-2">{p.phone || "—"}</td>
                  <td className="py-2 text-right font-medium text-amber-600">₦{Number(p.credit_balance).toLocaleString()}</td>
                  <td className="py-2 text-right">₦{Number(p.credit_limit).toLocaleString()}</td>
                  <td className="py-2 text-right">
                    <span className={`font-bold ${p.credit_score < 50 ? "text-destructive" : "text-foreground"}`}>{p.credit_score}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
