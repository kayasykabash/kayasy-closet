import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CreditCard, Wallet, AlertTriangle, Clock, CheckCircle2, History,
  ShoppingBag, Search, TrendingUp, Receipt, ArrowUpRight, Download, CalendarClock,
} from "lucide-react";
import { toast } from "sonner";

type Order = any;

export default function CreditWallet() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [payOrder, setPayOrder] = useState<Order | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("paystack");
  const [tab, setTab] = useState("orders");
  const [historySearch, setHistorySearch] = useState("");
  const [historyFilter, setHistoryFilter] = useState<string>("all");
  const [historyPage, setHistoryPage] = useState(1);
  const PAGE_SIZE = 8;

  const { data, isLoading } = useQuery({
    queryKey: ["credit-wallet", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: profile }, { data: orders }] = await Promise.all([
        supabase.from("profiles").select("credit_balance, credit_limit, credit_score, credit_approved").eq("user_id", user!.id).maybeSingle(),
        supabase.from("orders").select("*").eq("user_id", user!.id).eq("payment_method", "credit").order("created_at", { ascending: false }),
      ]);
      const all = (orders || []) as Order[];
      const unpaid = all.filter(o => o.payment_status !== "paid");
      const overdue = unpaid.filter(o => o.is_overdue);
      const totalOutstanding = unpaid.reduce((s, o) => s + Number(o.amount_due || o.total), 0);
      const overdueAmount = overdue.reduce((s, o) => s + Number(o.amount_due || o.total), 0);
      return { profile, all, unpaid, overdue, totalOutstanding, overdueAmount };
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["credit-repayments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("credit_repayments" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
  });

  const repay = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      if (!payOrder) throw new Error("No order selected");
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Enter a valid amount");
      const due = Number(payOrder.amount_due || payOrder.total);
      if (amt > due) throw new Error("Amount exceeds outstanding balance");
      const { data: result, error } = await supabase.rpc("repay_credit_order", {
        _order_id: payOrder.id,
        _amount: amt,
        _method: method,
      });
      if (error) throw error;
      return result;
    },
    onSuccess: (res: any) => {
      toast.success(res?.fully_paid ? "Order fully paid ✅" : `Payment of ₦${Number(amount).toLocaleString()} successful`);
      setPayOrder(null);
      setAmount("");
      qc.invalidateQueries({ queryKey: ["credit-wallet"] });
      qc.invalidateQueries({ queryKey: ["credit-repayments"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e: any) => toast.error(e.message || "Payment failed"),
  });

  const profile = data?.profile;
  const limit = Number(profile?.credit_limit || 0);
  const balance = Number(profile?.credit_balance || 0);
  const available = Math.max(0, limit - balance);
  const score = Number(profile?.credit_score || 100);
  const utilizationPct = limit > 0 ? Math.min(100, (balance / limit) * 100) : 0;

  const filteredHistory = useMemo(() => {
    let list = history;
    if (historyFilter !== "all") list = list.filter((r: any) => r.status === historyFilter);
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase();
      list = list.filter((r: any) =>
        (r.transaction_reference || "").toLowerCase().includes(q) ||
        (r.order_id || "").toLowerCase().includes(q) ||
        (r.payment_method || "").toLowerCase().includes(q));
    }
    return list;
  }, [history, historyFilter, historySearch]);

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / PAGE_SIZE));
  const pageRows = filteredHistory.slice((historyPage - 1) * PAGE_SIZE, historyPage * PAGE_SIZE);

  if (!user) return <Navigate to="/auth" replace />;

  const orderStatus = (o: Order): { label: string; cls: string; icon: any } => {
    if (o.payment_status === "paid") return { label: "Paid", cls: "bg-green-500/10 text-green-600", icon: CheckCircle2 };
    if (o.is_overdue) return { label: "Overdue", cls: "bg-destructive/10 text-destructive", icon: AlertTriangle };
    const due = Number(o.amount_due || o.total);
    if (due < Number(o.total)) return { label: "Partially Paid", cls: "bg-blue-500/10 text-blue-600", icon: TrendingUp };
    return { label: "Pending", cls: "bg-amber-500/10 text-amber-600", icon: Clock };
  };

  return (
    <Layout>
      <div className="container max-w-6xl py-6 space-y-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-heading text-2xl md:text-3xl font-bold">My Credit Wallet</h1>
            <p className="text-sm text-muted-foreground">Manage your Bashi (credit) account, repay orders and track payments</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button asChild variant="outline" size="sm">
              <Link to="/shop"><ShoppingBag className="h-4 w-4" /> Shop with Credit</Link>
            </Button>
            <Button size="sm" onClick={() => setTab("history")}>
              <History className="h-4 w-4" /> Repayment History
            </Button>
          </div>
        </div>

        {/* Stat Cards */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat icon={Wallet} label="Outstanding" value={`₦${(data?.totalOutstanding || 0).toLocaleString()}`} color="text-amber-500" bg="bg-amber-500/10" />
            <Stat icon={AlertTriangle} label="Overdue" value={`₦${(data?.overdueAmount || 0).toLocaleString()}`} color="text-destructive" bg="bg-destructive/10" />
            <Stat icon={CreditCard} label="Credit Limit" value={`₦${limit.toLocaleString()}`} color="text-blue-500" bg="bg-blue-500/10" />
            <Stat icon={CheckCircle2} label="Available" value={`₦${available.toLocaleString()}`} color="text-green-600" bg="bg-green-500/10" />
          </div>
        )}

        {/* Credit health */}
        <div className="bg-card border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <p className="text-xs text-muted-foreground">Credit Utilization</p>
              <p className="font-heading font-semibold">{utilizationPct.toFixed(0)}% used</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Credit Score</p>
              <p className={`font-heading font-bold ${score >= 75 ? "text-green-600" : score >= 50 ? "text-amber-500" : "text-destructive"}`}>
                {score}/100
              </p>
            </div>
          </div>
          <Progress value={utilizationPct} className="h-2" />
        </div>

        {data?.overdue && data.overdue.length > 0 && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-destructive text-sm">You have {data.overdue.length} overdue payment(s)</p>
              <p className="text-xs text-muted-foreground mt-0.5">Settle overdue balances to restore your full credit access.</p>
            </div>
          </div>
        )}

        <Tabs value={tab} onValueChange={(v) => { setTab(v); setHistoryPage(1); }}>
          <TabsList className="grid grid-cols-2 w-full max-w-sm">
            <TabsTrigger value="orders"><Receipt className="h-4 w-4 mr-1" /> Credit Orders</TabsTrigger>
            <TabsTrigger value="history"><History className="h-4 w-4 mr-1" /> History</TabsTrigger>
          </TabsList>

          {/* Orders */}
          <TabsContent value="orders" className="space-y-3 mt-4">
            {!data?.all || data.all.length === 0 ? (
              <div className="bg-card border rounded-xl p-10 text-center space-y-3">
                <div className="h-14 w-14 mx-auto rounded-full bg-muted flex items-center justify-center">
                  <Wallet className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="font-medium">You currently have no active credit orders.</p>
                <Button asChild><Link to="/shop"><ShoppingBag className="h-4 w-4" /> Shop Now</Link></Button>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {data.all.map((o: Order) => {
                  const total = Number(o.total);
                  const due = Number(o.amount_due ?? o.total);
                  const paidSoFar = Math.max(0, total - due);
                  const pct = total > 0 ? (paidSoFar / total) * 100 : 0;
                  const status = orderStatus(o);
                  const StatusIcon = status.icon;
                  const paid = o.payment_status === "paid";
                  return (
                    <div key={o.id} className={`bg-card border rounded-xl p-4 space-y-3 ${o.is_overdue && !paid ? "border-destructive/40" : ""}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Order ID</p>
                          <p className="font-mono text-sm font-medium">#{o.id.slice(0, 8).toUpperCase()}</p>
                        </div>
                        <Badge className={`${status.cls} gap-1 text-[10px]`}>
                          <StatusIcon className="h-3 w-3" /> {status.label}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <Cell label="Total" value={`₦${total.toLocaleString()}`} />
                        <Cell label="Paid" value={`₦${paidSoFar.toLocaleString()}`} accent="text-green-600" />
                        <Cell label="Remaining" value={`₦${due.toLocaleString()}`} accent="text-amber-600" />
                      </div>

                      <div className="space-y-1">
                        <Progress value={pct} className="h-1.5" />
                        <p className="text-[10px] text-muted-foreground">{pct.toFixed(0)}% repaid</p>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          Due: {o.due_date ? new Date(o.due_date).toLocaleDateString() : "—"}
                        </span>
                        {!paid && (
                          <Button size="sm" onClick={() => { setPayOrder(o); setAmount(String(due)); setMethod("paystack"); }}>
                            Repay Now <ArrowUpRight className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* History */}
          <TabsContent value="history" className="space-y-3 mt-4">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by reference, order or method"
                  value={historySearch}
                  onChange={(e) => { setHistorySearch(e.target.value); setHistoryPage(1); }}
                  className="pl-9"
                />
              </div>
              <Select value={historyFilter} onValueChange={(v) => { setHistoryFilter(v); setHistoryPage(1); }}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-card border rounded-xl overflow-hidden">
              {filteredHistory.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  No repayment transactions found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr className="text-xs text-muted-foreground">
                        <th className="text-left px-3 py-2">Transaction</th>
                        <th className="text-left px-3 py-2">Order</th>
                        <th className="text-right px-3 py-2">Amount</th>
                        <th className="text-left px-3 py-2">Method</th>
                        <th className="text-left px-3 py-2">Date</th>
                        <th className="text-left px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((r: any) => (
                        <tr key={r.id} className="border-t">
                          <td className="px-3 py-2 font-mono text-xs">{r.transaction_reference || r.id.slice(0, 10)}</td>
                          <td className="px-3 py-2 font-mono text-xs">#{(r.order_id || "").slice(0, 8).toUpperCase()}</td>
                          <td className="px-3 py-2 text-right font-medium">₦{Number(r.amount).toLocaleString()}</td>
                          <td className="px-3 py-2 capitalize">{r.payment_method}</td>
                          <td className="px-3 py-2 text-xs">{new Date(r.created_at).toLocaleString()}</td>
                          <td className="px-3 py-2">
                            <Badge className={
                              r.status === "success" ? "bg-green-500/10 text-green-600" :
                              r.status === "failed" ? "bg-destructive/10 text-destructive" :
                              "bg-amber-500/10 text-amber-600"
                            }>
                              {r.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {filteredHistory.length > 0 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Page {historyPage} of {totalPages} • {filteredHistory.length} record(s)</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={historyPage <= 1} onClick={() => setHistoryPage(p => p - 1)}>Prev</Button>
                  <Button variant="outline" size="sm" disabled={historyPage >= totalPages} onClick={() => setHistoryPage(p => p + 1)}>Next</Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Repayment Modal */}
      <Dialog open={!!payOrder} onOpenChange={(o) => !o && setPayOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Repay Credit Order</DialogTitle>
            <DialogDescription>Pay all or part of your outstanding balance.</DialogDescription>
          </DialogHeader>
          {payOrder && (() => {
            const total = Number(payOrder.total);
            const due = Number(payOrder.amount_due ?? payOrder.total);
            const amt = Number(amount) || 0;
            const overpay = amt > due;
            const invalid = amt <= 0;
            return (
              <div className="space-y-3">
                <div className="bg-muted/30 rounded-lg p-3 text-sm space-y-1">
                  <Row label="Order" value={`#${payOrder.id.slice(0,8).toUpperCase()}`} mono />
                  <Row label="Total" value={`₦${total.toLocaleString()}`} />
                  <Row label="Outstanding" value={`₦${due.toLocaleString()}`} bold />
                  {payOrder.due_date && <Row label="Due date" value={new Date(payOrder.due_date).toLocaleDateString()} />}
                </div>
                <div className="space-y-2">
                  <Label>Amount to pay (₦)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={due}
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  <div className="flex gap-2 flex-wrap">
                    <Button type="button" variant="outline" size="sm" onClick={() => setAmount(String(Math.round(due / 2)))}>Half</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setAmount(String(due))}>Full (₦{due.toLocaleString()})</Button>
                  </div>
                  {overpay && <p className="text-xs text-destructive">Amount exceeds outstanding balance</p>}
                  {amount !== "" && invalid && <p className="text-xs text-destructive">Enter a positive amount</p>}
                </div>
                <div className="space-y-2">
                  <Label>Payment method</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paystack">Paystack</SelectItem>
                      <SelectItem value="flutterwave">Flutterwave</SelectItem>
                      <SelectItem value="wallet">Wallet Balance</SelectItem>
                      <SelectItem value="transfer">Bank Transfer</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Payments are recorded instantly. Online gateway charges may apply for Paystack/Flutterwave.
                </p>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOrder(null)}>Cancel</Button>
            <Button
              onClick={() => repay.mutate()}
              disabled={
                repay.isPending ||
                !payOrder ||
                !amount ||
                Number(amount) <= 0 ||
                Number(amount) > Number(payOrder?.amount_due ?? payOrder?.total ?? 0)
              }
            >
              {repay.isPending ? "Processing..." : "Proceed Payment"}
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

function Cell({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-md bg-muted/40 p-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`font-semibold ${accent || ""}`}>{value}</p>
    </div>
  );
}

function Row({ label, value, mono, bold }: { label: string; value: string; mono?: boolean; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${mono ? "font-mono text-xs" : ""} ${bold ? "font-semibold" : ""}`}>{value}</span>
    </div>
  );
}
