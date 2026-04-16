import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Package, Clock, ShoppingBag } from "lucide-react";

const PaymentConfirmation = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("order");
  const [order, setOrder] = useState<any>(null);

  useEffect(() => {
    if (!orderId || !user) return;
    supabase.from("orders").select("*, order_items(*)").eq("id", orderId).single().then(({ data }) => setOrder(data));
  }, [orderId, user]);

  if (!order) return <Layout><div className="container py-12 text-center text-muted-foreground">Loading...</div></Layout>;

  return (
    <Layout>
      <div className="container max-w-lg py-8 space-y-6">
        {/* Success header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>
          <h1 className="font-heading text-2xl font-bold">Order Received!</h1>
          <p className="text-muted-foreground text-sm">Your order has been received and is being verified</p>
        </div>

        {/* Order details card */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Order ID</span>
            <span className="font-mono text-sm font-medium">#{order.id.slice(0, 8).toUpperCase()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Date</span>
            <span className="text-sm">{new Date(order.created_at).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="font-bold text-primary">₦{Number(order.total).toLocaleString()}</span>
          </div>
        </div>

        {/* Status cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border bg-card p-4 text-center">
            <Clock className="h-5 w-5 mx-auto text-amber-500 mb-2" />
            <p className="text-xs text-muted-foreground">Payment Status</p>
            <p className="text-sm font-semibold capitalize text-amber-500">Pending Verification</p>
          </div>
          <div className="rounded-xl border bg-card p-4 text-center">
            <Package className="h-5 w-5 mx-auto text-blue-500 mb-2" />
            <p className="text-xs text-muted-foreground">Delivery Status</p>
            <p className="text-sm font-semibold capitalize text-blue-500">Processing</p>
          </div>
        </div>

        {/* Items summary */}
        <div className="rounded-xl border bg-card p-5">
          <h2 className="font-heading font-semibold mb-3">Items Ordered</h2>
          {order.order_items?.map((item: any) => (
            <div key={item.id} className="flex justify-between py-2 border-b border-border/50 last:border-0 text-sm">
              <div className="flex items-center gap-3">
                {item.product_image && (
                  <img src={item.product_image} alt="" className="w-10 h-10 rounded object-cover" />
                )}
                <div>
                  <p className="font-medium">{item.product_name}</p>
                  {item.size && <p className="text-xs text-muted-foreground">Size: {item.size}</p>}
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium">₦{(item.price * item.quantity).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">×{item.quantity}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Estimated delivery */}
        <div className="rounded-xl border bg-accent/30 p-4 text-center">
          <p className="text-sm text-muted-foreground">Estimated Delivery</p>
          <p className="font-heading font-semibold">3 – 7 Business Days</p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Link to="/orders">
            <Button className="w-full" variant="default">
              <ShoppingBag className="h-4 w-4 mr-2" /> Track My Orders
            </Button>
          </Link>
          <Link to="/shop">
            <Button className="w-full" variant="outline">Continue Shopping</Button>
          </Link>
        </div>
      </div>
    </Layout>
  );
};

export default PaymentConfirmation;
