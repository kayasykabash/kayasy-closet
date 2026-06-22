import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, Clock, Upload, AlertTriangle, CheckCircle2, MessageCircle } from "lucide-react";

const BANK_DETAILS = {
  bankName: "United Bank for Africa (UBA)",
  accountName: "SAMUEL EMMANUEL",
  accountNumber: "2211235178",
};

const TIMER_MINUTES = 30;

const PaymentPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("order");

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIMER_MINUTES * 60);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [reference, setReference] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch order
  useEffect(() => {
    if (!orderId || !user) { navigate("/cart"); return; }
    (async () => {
      const { data } = await supabase.from("orders").select("*, order_items(*)").eq("id", orderId).single();
      if (!data || data.user_id !== user.id) { navigate("/cart"); return; }
      setOrder(data);
      setLoading(false);

      // Set expiry if not set
      if (!data.payment_expires_at) {
        const expires = new Date(Date.now() + TIMER_MINUTES * 60 * 1000).toISOString();
        await supabase.from("orders").update({ payment_expires_at: expires }).eq("id", data.id);
      } else {
        const remaining = Math.max(0, Math.floor((new Date(data.payment_expires_at).getTime() - Date.now()) / 1000));
        setTimeLeft(remaining);
      }
    })();
  }, [orderId, user, navigate]);

  // Countdown
  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const copyAccount = () => {
    navigator.clipboard.writeText(BANK_DETAILS.accountNumber);
    toast.success("Account number copied!");
  };

  const orderRef = order ? `#${order.id.slice(0, 8).toUpperCase()}` : "";
  const copyRef = () => {
    if (!order) return;
    navigator.clipboard.writeText(orderRef);
    toast.success("Order reference copied!");
  };

  const handleSubmit = async () => {
    if (!user || !order) return;
    if (!proofFile) { toast.error("Please upload proof of payment"); return; }
    setSubmitting(true);

    try {
      // Upload proof
      const ext = proofFile.name.split(".").pop();
      const path = `${user.id}/${order.id}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("payment-proofs").upload(path, proofFile, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("payment-proofs").getPublicUrl(path);

      // Update order
      const { error } = await supabase.from("orders").update({
        payment_status: "pending_verification",
        payment_proof_url: urlData.publicUrl,
        payment_reference: reference || null,
      }).eq("id", order.id);
      if (error) throw error;

      navigate(`/payment/confirmation?order=${order.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit payment");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Layout><div className="container py-12 text-center text-muted-foreground">Loading...</div></Layout>;

  const isExpired = timeLeft <= 0;

  return (
    <Layout>
      <div className="container max-w-lg py-6 space-y-5">
        {/* Warning banner */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Do not leave this page until payment is completed</span>
        </div>

        <h1 className="font-heading text-2xl font-bold">Complete Payment</h1>

        {/* Timer */}
        <div className={`flex items-center gap-2 p-4 rounded-xl border ${isExpired ? "bg-destructive/10 border-destructive/30" : "bg-accent/30 border-accent"}`}>
          <Clock className={`h-5 w-5 ${isExpired ? "text-destructive" : "text-primary"}`} />
          <div>
            <p className="text-xs text-muted-foreground">Payment reservation expires in</p>
            <p className={`text-2xl font-mono font-bold ${isExpired ? "text-destructive" : "text-primary"}`}>
              {isExpired ? "EXPIRED" : formatTime(timeLeft)}
            </p>
          </div>
        </div>

        {/* Amount */}
        <div className="text-center p-5 rounded-xl border bg-card">
          <p className="text-sm text-muted-foreground mb-1">Total Amount to Pay</p>
          <p className="text-3xl font-heading font-bold text-primary">₦{Number(order.total).toLocaleString()}</p>
          <div className="flex items-center justify-center gap-2 mt-3 pt-3 border-t border-border/50">
            <span className="text-xs text-muted-foreground">Order Ref:</span>
            <span className="font-mono text-sm font-semibold">{orderRef}</span>
            <Button variant="ghost" size="sm" onClick={copyRef} className="h-6 px-1.5">
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">Use this reference as your transfer narration</p>
        </div>

        {/* Bank details */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h2 className="font-heading font-semibold text-lg">Bank Transfer Details</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Bank Name</span>
              <span className="font-medium text-sm">{BANK_DETAILS.bankName}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Account Name</span>
              <span className="font-medium text-sm">{BANK_DETAILS.accountName}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-muted-foreground">Account Number</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-lg">{BANK_DETAILS.accountNumber}</span>
                <Button variant="outline" size="sm" onClick={copyAccount} className="h-8 px-2">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Upload proof */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h2 className="font-heading font-semibold">Upload Payment Proof</h2>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
          >
            {proofFile ? (
              <div className="flex items-center justify-center gap-2 text-sm">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="font-medium">{proofFile.name}</span>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Click to upload receipt or screenshot</p>
                <p className="text-xs text-muted-foreground mt-1">JPG, PNG, PDF up to 5MB</p>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f && f.size > 5 * 1024 * 1024) { toast.error("File must be under 5MB"); return; }
              setProofFile(f || null);
            }}
          />

          <div>
            <Label htmlFor="ref">Transaction Reference (optional)</Label>
            <Input id="ref" value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. Transfer reference number" className="mt-1" />
          </div>
        </div>

        <Button
          className="w-full h-12 text-base font-semibold"
          onClick={handleSubmit}
          disabled={submitting || isExpired || !proofFile}
        >
          {submitting ? "Submitting..." : "I Have Made Payment"}
        </Button>

        {/* WhatsApp backup */}
        <a
          href={`https://wa.me/2348000000000?text=${encodeURIComponent(`Hi, I just made a payment of ₦${Number(order.total).toLocaleString()} for order ${orderRef}. Here is my receipt.`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 text-sm font-medium text-green-600 hover:text-green-700 transition-colors py-3 rounded-lg border border-green-500/20 bg-green-500/5"
        >
          <MessageCircle className="h-4 w-4" />
          Sent payment? Message us your receipt on WhatsApp too
        </a>
      </div>
    </Layout>
  );
};

export default PaymentPage;
