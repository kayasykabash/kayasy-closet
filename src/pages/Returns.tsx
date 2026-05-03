import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const statusColor: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  refunded: "bg-blue-100 text-blue-800",
};

const ReturnsPage = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const [orderId, setOrderId] = useState(params.get("order") || "");
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState("store_credit");

  const { data: orders = [] } = useQuery({
    queryKey: ["return-eligible-orders", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("orders")
        .select("id, created_at, total, status")
        .eq("user_id", user.id)
        .in("status", ["delivered", "shipped"])
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: returns = [] } = useQuery({
    queryKey: ["returns", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("return_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in required");
      if (!orderId) throw new Error("Select an order");
      if (!reason.trim()) throw new Error("Reason is required");
      const { error } = await supabase.from("return_requests").insert({
        user_id: user.id,
        order_id: orderId,
        reason: reason.trim(),
        refund_method: refundMethod,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Return request submitted");
      setReason("");
      setOrderId("");
      qc.invalidateQueries({ queryKey: ["returns"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (!user) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <p className="text-muted-foreground mb-2">Please sign in to manage returns.</p>
          <Link to="/auth" className="text-primary hover:underline">Sign In</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-6 max-w-2xl">
        <h1 className="font-heading text-2xl font-bold mb-6 flex items-center gap-2">
          <RotateCcw className="h-6 w-6 text-primary" /> Returns & Refunds
        </h1>

        <div className="border rounded-lg p-4 mb-6 bg-card">
          <h2 className="font-medium mb-3">Submit a Return Request</h2>
          <div className="space-y-3">
            <div>
              <Label>Order</Label>
              <Select value={orderId} onValueChange={setOrderId}>
                <SelectTrigger><SelectValue placeholder="Select an order" /></SelectTrigger>
                <SelectContent>
                  {orders.length === 0 && <SelectItem value="none" disabled>No eligible orders</SelectItem>}
                  {orders.map(o => (
                    <SelectItem key={o.id} value={o.id}>
                      #{o.id.slice(0, 8)} — ₦{Number(o.total).toLocaleString()} ({new Date(o.created_at).toLocaleDateString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Why are you returning this order?" />
            </div>
            <div>
              <Label>Refund Method</Label>
              <Select value={refundMethod} onValueChange={setRefundMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="store_credit">Store Credit</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => submit.mutate()} disabled={submit.isPending} className="w-full">
              {submit.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </div>

        <h2 className="font-medium mb-3">Your Return Requests</h2>
        {returns.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No return requests yet
          </div>
        ) : (
          <div className="space-y-3">
            {returns.map(r => (
              <div key={r.id} className="border rounded-lg p-4 bg-card">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <p className="text-xs text-muted-foreground">
                    Order #{r.order_id.slice(0, 8)} • {new Date(r.created_at).toLocaleDateString()}
                  </p>
                  <Badge className={statusColor[r.status] || "bg-muted"}>{r.status}</Badge>
                </div>
                <p className="text-sm mb-1"><span className="text-muted-foreground">Reason:</span> {r.reason}</p>
                {r.refund_method && (
                  <p className="text-xs text-muted-foreground">Refund: {r.refund_method.replace("_", " ")}</p>
                )}
                {r.admin_notes && (
                  <p className="text-xs mt-2 p-2 rounded bg-muted">
                    <span className="font-medium">Admin note:</span> {r.admin_notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ReturnsPage;
