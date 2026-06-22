import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDeliveryZones } from "@/hooks/useDeliveryZones";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Banknote, Truck, Store, CreditCard, MapPin } from "lucide-react";
import { getVariantUnitPrice } from "@/lib/pricing";

type PaymentMethod = "bank_transfer" | "cod" | "pickup" | "credit";

const CheckoutPage = () => {
  const { cartItems, total, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("bank_transfer");
  const [zoneId, setZoneId] = useState<string>("");
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [form, setForm] = useState({
    address: "",
    city: "",
    state: "",
    phone: "",
    notes: "",
  });

  const { data: zones = [] } = useDeliveryZones();
  const { data: addresses = [] } = useQuery({
    queryKey: ["checkout-addresses", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_addresses").select("*").order("is_default", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => setProfile(data));
  }, [user]);

  // Auto-fill default address
  useEffect(() => {
    if (addresses.length && !selectedAddressId) {
      const def = addresses.find((a: any) => a.is_default) || addresses[0];
      if (def) {
        setSelectedAddressId(def.id);
        setForm(f => ({ ...f, address: def.address, city: def.city, state: def.state, phone: def.phone }));
      }
    }
  }, [addresses, selectedAddressId]);

  const selectedZone = zones.find((z: any) => z.id === zoneId);
  const deliveryFee = paymentMethod === "pickup" ? 0 : (selectedZone ? Number(selectedZone.fee) : (total >= 50000 ? 0 : 2500));
  const grandTotal = total + deliveryFee;

  const creditAvailable = profile?.credit_approved
    ? Math.max(0, Number(profile.credit_limit || 0) - Number(profile.credit_balance || 0))
    : 0;
  const creditWillExceed = paymentMethod === "credit" && grandTotal > creditAvailable;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || cartItems.length === 0) return;
    if (paymentMethod === "credit" && !profile?.credit_approved) {
      toast.error("Your account is not approved for credit. Contact support.");
      return;
    }
    if (creditWillExceed) {
      toast.error("This purchase exceeds your available credit.");
      return;
    }
    setLoading(true);

    try {
      const orderPayload: any = {
        user_id: user.id,
        total: grandTotal,
        delivery_address: paymentMethod === "pickup" ? "Pickup at store" : form.address,
        delivery_city: form.city,
        delivery_state: form.state,
        delivery_phone: form.phone,
        delivery_zone_id: paymentMethod === "pickup" ? null : (zoneId || null),
        delivery_fee: deliveryFee,
        notes: form.notes,
        payment_method: paymentMethod,
      };
      // For COD/pickup, payment is collected later; for credit, trigger handles it
      if (paymentMethod === "cod" || paymentMethod === "pickup") {
        orderPayload.payment_status = "pending";
      }

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert(orderPayload)
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = cartItems.map((item: any) => {
        const product = item.product;
        const variant = item.variant;
        const unitPrice = getVariantUnitPrice(product?.price || 0, variant);
        return {
          order_id: order.id,
          product_id: item.product_id,
          product_name: product?.name || "Unknown",
          product_image: item.variant_image || variant?.images?.[0] || product?.images?.[0] || null,
          quantity: item.quantity,
          price: unitPrice,
          size: item.size,
          color: item.color || variant?.color,
          design: item.design || variant?.design_name,
          variant_id: item.variant_id || null,
          variant_design: variant?.design_name || null,
          variant_color: variant?.color || null,
          variant_image: item.variant_image || variant?.images?.[0] || null,
        };
      });

      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
      if (itemsError) throw itemsError;

      await clearCart.mutateAsync();

      if (paymentMethod === "bank_transfer") {
        toast.success("Order created! Complete your bank transfer.");
        navigate(`/payment?order=${order.id}`);
      } else {
        toast.success("Order placed successfully!");
        navigate(`/orders`);
      }
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

  const methods: { id: PaymentMethod; label: string; desc: string; icon: any; disabled?: boolean; recommended?: boolean }[] = [
    { id: "bank_transfer", label: "Bank Transfer (UBA)", desc: "Recommended — instant, secure transfer to our bank account", icon: Banknote, recommended: true },
    ...(profile?.credit_approved
      ? [{
          id: "credit" as PaymentMethod,
          label: `Credit / Bashi (₦${creditAvailable.toLocaleString()} available)`,
          desc: "Buy now, pay later",
          icon: CreditCard,
          disabled: false,
        }]
      : []),
  ];

  return (
    <Layout>
      <div className="container max-w-2xl py-6">
        <h1 className="font-heading text-2xl font-bold mb-6">Checkout</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Saved addresses */}
          {addresses.length > 0 && paymentMethod !== "pickup" && (
            <div className="border rounded-lg p-4 bg-card">
              <h2 className="font-heading font-semibold mb-3 text-sm flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Saved Addresses</h2>
              <div className="grid sm:grid-cols-2 gap-2">
                {addresses.map((a: any) => (
                  <button
                    type="button"
                    key={a.id}
                    onClick={() => {
                      setSelectedAddressId(a.id);
                      setForm(f => ({ ...f, address: a.address, city: a.city, state: a.state, phone: a.phone }));
                    }}
                    className={`text-left p-3 rounded-lg border text-xs transition-colors ${
                      selectedAddressId === a.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                  >
                    <p className="font-semibold">{a.label || "Address"} {a.is_default && <span className="text-primary">★</span>}</p>
                    <p className="text-muted-foreground line-clamp-2">{a.address}, {a.city}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Delivery */}
          <div className="border rounded-lg p-6 bg-card space-y-4">
            <h2 className="font-heading font-semibold">Delivery Details</h2>
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} required placeholder="+234..." />
            </div>
            {paymentMethod !== "pickup" && (
              <div>
                <Label htmlFor="address">Delivery Address</Label>
                <Textarea id="address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} required placeholder="Street address" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">City</Label>
                <Input id="city" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} required={paymentMethod !== "pickup"} />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input id="state" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} required={paymentMethod !== "pickup"} />
              </div>
            </div>
            {paymentMethod !== "pickup" && (
              <div>
                <Label>Delivery Zone</Label>
                <Select value={zoneId} onValueChange={setZoneId}>
                  <SelectTrigger><SelectValue placeholder="Select your delivery zone" /></SelectTrigger>
                  <SelectContent>
                    {zones.map((z: any) => (
                      <SelectItem key={z.id} value={z.id}>
                        {z.name} — ₦{Number(z.fee).toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Picking a zone calculates exact delivery fee</p>
              </div>
            )}
            <div>
              <Label htmlFor="notes">Order Notes (optional)</Label>
              <Textarea id="notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any special instructions" />
            </div>
          </div>

          {/* Payment Methods */}
          <div className="border rounded-lg p-6 bg-card space-y-4">
            <h2 className="font-heading font-semibold">Payment Method</h2>
            <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
              {methods.map(m => (
                <label
                  key={m.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    paymentMethod === m.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  } ${m.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <RadioGroupItem value={m.id} disabled={m.disabled} className="mt-1" />
                  <m.icon className="h-5 w-5 mt-0.5 text-primary shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.desc}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
            {creditWillExceed && (
              <p className="text-xs text-destructive">This order exceeds your available credit (₦{creditAvailable.toLocaleString()}).</p>
            )}
          </div>

          {/* Summary */}
          <div className="border rounded-lg p-6 bg-card">
            <h2 className="font-heading font-semibold mb-3">Order Summary</h2>
            {cartItems.map((item: any) => {
              const product = item.product;
              const variant = item.variant;
              const unit = getVariantUnitPrice(product?.price || 0, variant);
              const label = [variant?.design_name, item.size, item.color].filter(Boolean).join(" / ");
              return (
                <div key={item.id} className="flex justify-between text-sm py-1">
                  <span>{product?.name} x{item.quantity}{label ? ` (${label})` : ""}</span>
                  <span>₦{(unit * item.quantity).toLocaleString()}</span>
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

          <Button type="submit" className="w-full" disabled={loading || creditWillExceed}>
            {loading ? "Placing Order..." : `Place Order — ₦${grandTotal.toLocaleString()}`}
          </Button>
        </form>
      </div>
    </Layout>
  );
};

export default CheckoutPage;
