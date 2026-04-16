import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const CheckoutPage = () => {
  const { cartItems, total, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    address: "",
    city: "",
    state: "",
    phone: "",
    notes: "",
  });

  const deliveryFee = total >= 50000 ? 0 : 2500;
  const grandTotal = total + deliveryFee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || cartItems.length === 0) return;
    setLoading(true);

    try {
      // Create order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          total: grandTotal,
          delivery_address: form.address,
          delivery_city: form.city,
          delivery_state: form.state,
          delivery_phone: form.phone,
          notes: form.notes,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = cartItems.map(item => {
        const product = (item as any).product;
        return {
          order_id: order.id,
          product_id: item.product_id,
          product_name: product?.name || "Unknown",
          product_image: product?.images?.[0] || null,
          quantity: item.quantity,
          price: product?.price || 0,
          size: item.size,
        };
      });

      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
      if (itemsError) throw itemsError;

      // Clear cart and redirect to payment
      await clearCart.mutateAsync();
      toast.success("Order created! Complete your payment.");
      navigate(`/payment?order=${order.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to place order");
    } finally {
      setLoading(false);
    }
  };

  if (!user || cartItems.length === 0) {
    navigate("/cart");
    return null;
  }

  return (
    <Layout>
      <div className="container max-w-2xl py-6">
        <h1 className="font-heading text-2xl font-bold mb-6">Checkout</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="border rounded-lg p-6 bg-card space-y-4">
            <h2 className="font-heading font-semibold">Delivery Details</h2>
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} required placeholder="+234..." />
            </div>
            <div>
              <Label htmlFor="address">Delivery Address</Label>
              <Textarea id="address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} required placeholder="Street address" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">City</Label>
                <Input id="city" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} required />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input id="state" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} required />
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Order Notes (optional)</Label>
              <Textarea id="notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any special instructions" />
            </div>
          </div>

          {/* Summary */}
          <div className="border rounded-lg p-6 bg-card">
            <h2 className="font-heading font-semibold mb-3">Order Summary</h2>
            {cartItems.map(item => {
              const product = (item as any).product;
              return (
                <div key={item.id} className="flex justify-between text-sm py-1">
                  <span>{product?.name} x{item.quantity} {item.size ? `(${item.size})` : ""}</span>
                  <span>₦{((product?.price || 0) * item.quantity).toLocaleString()}</span>
                </div>
              );
            })}
            <div className="border-t mt-3 pt-3 space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>₦{total.toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Delivery</span><span>{deliveryFee === 0 ? "Free" : `₦${deliveryFee.toLocaleString()}`}</span></div>
              <div className="flex justify-between font-bold text-base pt-2 border-t">
                <span>Total</span><span className="text-primary">₦{grandTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Placing Order..." : `Place Order — ₦${grandTotal.toLocaleString()}`}
          </Button>
        </form>
      </div>
    </Layout>
  );
};

export default CheckoutPage;
