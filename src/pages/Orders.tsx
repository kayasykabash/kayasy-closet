import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, CreditCard, Truck, CheckCircle2, XCircle, Clock, AlertTriangle, FileText } from "lucide-react";
import { generateInvoicePDF } from "@/lib/invoice";
import { toast } from "sonner";

const statusColor: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const paymentStatusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  unpaid: { label: "Unpaid", color: "bg-red-100 text-red-800", icon: <XCircle className="h-3.5 w-3.5" /> },
  pending_verification: { label: "Verifying", color: "bg-yellow-100 text-yellow-800", icon: <Clock className="h-3.5 w-3.5" /> },
  paid: { label: "Paid", color: "bg-green-100 text-green-800", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
};

const orderSteps = [
  { key: "pending", label: "Order Placed", icon: Package },
  { key: "processing", label: "Processing", icon: CreditCard },
  { key: "shipped", label: "Shipped", icon: Truck },
  { key: "delivered", label: "Delivered", icon: CheckCircle2 },
];

const OrderTracker = ({ status }: { status: string }) => {
  const currentIdx = orderSteps.findIndex(s => s.key === status);
  return (
    <div className="flex items-center gap-1 mt-3">
      {orderSteps.map((step, i) => {
        const Icon = step.icon;
        const isActive = i <= currentIdx;
        return (
          <div key={step.key} className="flex items-center gap-1 flex-1">
            <div className={`flex flex-col items-center flex-1 ${isActive ? "text-primary" : "text-muted-foreground/40"}`}>
              <Icon className="h-4 w-4 mb-0.5" />
              <span className="text-[10px] leading-tight text-center">{step.label}</span>
            </div>
            {i < orderSteps.length - 1 && (
              <div className={`h-0.5 flex-1 rounded ${i < currentIdx ? "bg-primary" : "bg-muted"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
};

const OrdersPage = () => {
  const { user } = useAuth();

  const { data: orders = [] } = useQuery({
    queryKey: ["orders", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  if (!user) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <p className="text-muted-foreground">Please sign in to view your orders.</p>
          <Link to="/auth" className="text-primary hover:underline">Sign In</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-6">
        <h1 className="font-heading text-2xl font-bold mb-6">My Orders</h1>

        {orders.length === 0 ? (
          <div className="py-16 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No orders yet</p>
            <Link to="/shop"><button className="text-primary hover:underline">Start Shopping</button></Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map(order => {
              const ps = paymentStatusConfig[order.payment_status] || paymentStatusConfig.unpaid;
              const handleInvoice = async () => {
                try {
                  const { data: profile } = await supabase.from("profiles").select("full_name, phone").eq("user_id", user.id).maybeSingle();
                  generateInvoicePDF(order as any, (order as any).order_items || [], { full_name: profile?.full_name, phone: profile?.phone, email: user.email });
                } catch (err: any) {
                  toast.error("Could not generate invoice");
                }
              };
              return (
                <div key={order.id} className="border rounded-lg p-4 bg-card">
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Order #{order.id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {order.is_overdue && order.payment_status !== "paid" && (
                        <Badge className="bg-destructive/10 text-destructive flex items-center gap-1 text-[10px]">
                          <AlertTriangle className="h-3 w-3" /> Overdue
                        </Badge>
                      )}
                      <Badge className={ps.color + " flex items-center gap-1 text-[10px]"}>
                        {ps.icon} {ps.label}
                      </Badge>
                      <Badge className={statusColor[order.status] || "bg-muted"}>
                        {order.status}
                      </Badge>
                    </div>
                  </div>

                  {order.payment_status === "rejected" && (
                    <div className="flex items-center gap-2 p-2 rounded bg-destructive/10 text-destructive text-xs mb-2">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Payment rejected — please <Link to={`/payment?order=${order.id}`} className="underline font-medium">retry payment</Link>
                    </div>
                  )}

                  {order.payment_status === "unpaid" && order.status === "pending" && (
                    <div className="flex items-center gap-2 p-2 rounded bg-accent/50 text-xs mb-2">
                      <CreditCard className="h-3.5 w-3.5 text-primary" />
                      <Link to={`/payment?order=${order.id}`} className="text-primary underline font-medium">Complete Payment</Link>
                    </div>
                  )}

                  {order.payment_method === "credit" && order.due_date && (
                    <div className={`flex items-center justify-between gap-2 p-2 rounded text-xs mb-2 ${
                      order.payment_status === "paid"
                        ? "bg-green-500/10 text-green-700"
                        : order.is_overdue
                        ? "bg-destructive/10 text-destructive"
                        : "bg-amber-500/10 text-amber-700"
                    }`}>
                      <span className="flex items-center gap-1">
                        <CreditCard className="h-3.5 w-3.5" />
                        Credit (Bashi) — Due {new Date(order.due_date).toLocaleDateString()}
                      </span>
                      <span className="font-semibold">
                        {order.payment_status === "paid" ? "Paid ✅" : order.is_overdue ? "Overdue ❌" : "Pending ⏳"}
                      </span>
                    </div>
                  )}

                  <div className="space-y-1 text-sm">
                    {(order as any).order_items?.map((item: any) => (
                      <div key={item.id} className="flex justify-between">
                        <span>{item.product_name} x{item.quantity}</span>
                        <span>₦{(item.price * item.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t mt-3 pt-2 flex justify-between font-bold text-sm">
                    <span>Total</span>
                    <span className="text-primary">₦{Number(order.total).toLocaleString()}</span>
                  </div>

                  {order.status !== "cancelled" && <OrderTracker status={order.status} />}

                  <div className="flex gap-2 mt-3">
                    <Button variant="outline" size="sm" className="flex-1" onClick={handleInvoice}>
                      <FileText className="h-3.5 w-3.5 mr-1" /> Invoice
                    </Button>
                    {(order.status === "delivered" || order.status === "shipped") && (
                      <Link to={`/returns?order=${order.id}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full">Request Return</Button>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default OrdersPage;
