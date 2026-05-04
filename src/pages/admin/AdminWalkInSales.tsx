import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ShoppingBag, Plus, Trash2, Banknote, CreditCard, ArrowRightLeft } from "lucide-react";

type PaymentMethod = "cash" | "transfer" | "pos";

export default function AdminWalkInSales() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");

  const { data: products = [] } = useQuery({
    queryKey: ["walkin-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, stock")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["walkin-sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("walkin_sales")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId),
    [products, productId],
  );
  const qty = Math.max(1, parseInt(quantity || "1", 10) || 1);
  const total = selectedProduct ? Number(selectedProduct.price) * qty : 0;

  const todayTotal = useMemo(() => {
    const today = new Date().toDateString();
    return sales
      .filter((s: any) => new Date(s.created_at).toDateString() === today)
      .reduce((sum: number, s: any) => sum + Number(s.total_price), 0);
  }, [sales]);

  const grandTotal = useMemo(
    () => sales.reduce((s: number, x: any) => s + Number(x.total_price), 0),
    [sales],
  );

  const createSale = useMutation({
    mutationFn: async () => {
      if (!selectedProduct) throw new Error("Please select a product");
      if (qty > selectedProduct.stock) {
        throw new Error(`Only ${selectedProduct.stock} in stock`);
      }
      const { error } = await supabase.from("walkin_sales").insert({
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        quantity: qty,
        unit_price: Number(selectedProduct.price),
        total_price: Number(selectedProduct.price) * qty,
        payment_method: paymentMethod,
        customer_name: customerName || null,
        notes: notes || null,
        sold_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Walk-in sale recorded");
      setProductId("");
      setQuantity("1");
      setCustomerName("");
      setNotes("");
      setPaymentMethod("cash");
      qc.invalidateQueries({ queryKey: ["walkin-sales"] });
      qc.invalidateQueries({ queryKey: ["walkin-products"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      qc.invalidateQueries({ queryKey: ["admin-pl"] });
      qc.invalidateQueries({ queryKey: ["admin-low-stock"] });
    },
    onError: (e: any) => toast.error(e.message || "Failed to record sale"),
  });

  const deleteSale = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("walkin_sales").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sale removed and stock restored");
      qc.invalidateQueries({ queryKey: ["walkin-sales"] });
      qc.invalidateQueries({ queryKey: ["walkin-products"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      qc.invalidateQueries({ queryKey: ["admin-pl"] });
    },
    onError: (e: any) => toast.error(e.message || "Failed to delete sale"),
  });

  const paymentIcon = (m: string) =>
    m === "cash" ? <Banknote className="h-3.5 w-3.5" /> :
    m === "transfer" ? <ArrowRightLeft className="h-3.5 w-3.5" /> :
    <CreditCard className="h-3.5 w-3.5" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" /> Walk-in Sales (POS)
          </h1>
          <p className="text-sm text-muted-foreground">Record offline shop sales — stock & revenue update automatically.</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Today's Walk-in Sales</p>
          <p className="font-heading text-xl font-bold mt-1">₦{todayTotal.toLocaleString()}</p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">All-Time Walk-in Revenue</p>
          <p className="font-heading text-xl font-bold mt-1">₦{grandTotal.toLocaleString()}</p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Total Transactions</p>
          <p className="font-heading text-xl font-bold mt-1">{sales.length}</p>
        </div>
      </div>

      {/* New sale form */}
      <div className="bg-card border rounded-xl p-4 sm:p-6">
        <h3 className="font-heading font-semibold text-sm mb-4 flex items-center gap-2">
          <Plus className="h-4 w-4" /> Record New Sale
        </h3>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Product</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id} disabled={p.stock <= 0}>
                    {p.name} — ₦{Number(p.price).toLocaleString()} ({p.stock} in stock)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Quantity</Label>
            <Input
              type="number"
              min={1}
              max={selectedProduct?.stock || undefined}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            {selectedProduct && (
              <p className="text-xs text-muted-foreground">{selectedProduct.stock} available</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select value={paymentMethod} onValueChange={(v: PaymentMethod) => setPaymentMethod(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="transfer">Bank Transfer</SelectItem>
                <SelectItem value="pos">POS / Card</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Customer Name (optional)</Label>
            <Input
              placeholder="Walk-in customer"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Any additional details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-5 pt-4 border-t flex-wrap gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="font-heading text-2xl font-bold text-primary">
              ₦{total.toLocaleString()}
            </p>
          </div>
          <Button
            onClick={() => createSale.mutate()}
            disabled={!productId || createSale.isPending || qty < 1}
            size="lg"
          >
            {createSale.isPending ? "Recording..." : "Record Sale"}
          </Button>
        </div>
      </div>

      {/* Sales list */}
      <div className="bg-card border rounded-xl p-4 sm:p-6">
        <h3 className="font-heading font-semibold text-sm mb-4">All Walk-in Sales</h3>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : sales.length === 0 ? (
          <p className="text-sm text-muted-foreground">No walk-in sales yet</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(s.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-medium">{s.product_name}</TableCell>
                    <TableCell className="text-center">{s.quantity}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs capitalize">
                        {paymentIcon(s.payment_method)} {s.payment_method}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{s.customer_name || "—"}</TableCell>
                    <TableCell className="text-right font-bold">
                      ₦{Number(s.total_price).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reverse this sale?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete the sale record and restore {s.quantity} unit(s) of {s.product_name} back to stock.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteSale.mutate(s.id)}>
                              Delete & Restore Stock
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
