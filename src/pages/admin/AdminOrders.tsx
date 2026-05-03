import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, Eye, Download, CheckCircle2, XCircle, Image, FileText } from "lucide-react";
import { generateInvoicePDF } from "@/lib/invoice";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

const statusOptions = ["pending", "processing", "shipped", "delivered", "cancelled"];
const paymentStatusOptions = ["unpaid", "pending_verification", "paid", "rejected"];

export default function AdminOrders() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const { data: orders = [] } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("*, order_items(*)").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-orders"] }); toast.success("Order updated"); },
  });

  const updatePaymentStatus = useMutation({
    mutationFn: async ({ id, payment_status }: { id: string; payment_status: string }) => {
      const updates: any = { payment_status };
      if (payment_status === "paid") updates.status = "processing";
      const { error } = await supabase.from("orders").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      toast.success("Payment status updated");
      if (selectedOrder) {
        // Refresh selected order
        supabase.from("orders").select("*, order_items(*)").eq("id", selectedOrder.id).single().then(({ data }) => setSelectedOrder(data));
      }
    },
  });

  const filtered = orders.filter((o: any) => {
    const matchSearch = o.id.includes(search) || o.delivery_address?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || o.status === filterStatus || o.payment_status === filterStatus;
    return matchSearch && matchStatus;
  });

  const paymentBadgeColor = (status: string) => {
    switch (status) {
      case "paid": return "bg-green-500/10 text-green-600 border-green-500/20";
      case "pending_verification": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "rejected": return "bg-destructive/10 text-destructive border-destructive/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const exportCSV = () => {
    const headers = ["Order ID", "Date", "Status", "Payment", "Total", "Address", "City", "State"];
    const rows = orders.map((o: any) => [
      o.id, new Date(o.created_at).toLocaleDateString(), o.status, o.payment_status,
      o.total, o.delivery_address, o.delivery_city, o.delivery_state,
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "orders.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const pendingPayments = orders.filter((o: any) => o.payment_status === "pending_verification").length;

  const downloadInvoice = async (order: any) => {
    try {
      let items = order.order_items;
      if (!items) {
        const { data } = await supabase.from("order_items").select("*").eq("order_id", order.id);
        items = data || [];
      }
      let customer: any = {};
      if (order.user_id) {
        const { data: profile } = await supabase.from("profiles").select("full_name, phone").eq("user_id", order.user_id).maybeSingle();
        if (profile) customer = profile;
      }
      generateInvoicePDF(order, items, customer);
    } catch (e: any) {
      toast.error("Failed to generate invoice");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold">Orders ({orders.length})</h1>
          {pendingPayments > 0 && (
            <p className="text-sm text-amber-600">{pendingPayments} payment(s) awaiting verification</p>
          )}
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {statusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              <SelectItem value="pending_verification">Pending Payment</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Order</th>
                <th className="text-left p-3 font-medium hidden sm:table-cell">Date</th>
                <th className="text-left p-3 font-medium">Payment</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-right p-3 font-medium">Total</th>
                <th className="text-right p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o: any) => (
                <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">#{o.id.slice(0, 8)}</td>
                  <td className="p-3 hidden sm:table-cell text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</td>
                  <td className="p-3">
                    <div className="flex flex-col gap-1">
                      <Badge variant="outline" className={`text-xs capitalize ${paymentBadgeColor(o.payment_status)}`}>
                        {o.payment_status === "pending_verification" ? "Pending" : o.payment_status}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground capitalize">{(o.payment_method || "bank_transfer").replace(/_/g, " ")}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <Select value={o.status} onValueChange={v => updateStatus.mutate({ id: o.id, status: v })}>
                      <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {statusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3 text-right font-medium">₦{Number(o.total).toLocaleString()}</td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => downloadInvoice(o)} title="Download invoice">
                        <FileText className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedOrder(o)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No orders found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order detail dialog with payment verification */}
      <Dialog open={!!selectedOrder} onOpenChange={open => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Order #{selectedOrder?.id.slice(0, 8)}</DialogTitle></DialogHeader>
          {selectedOrder && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Date:</span><br />{new Date(selectedOrder.created_at).toLocaleString()}</div>
                <div><span className="text-muted-foreground">Status:</span><br /><span className="font-medium capitalize">{selectedOrder.status}</span></div>
              </div>

              {/* Payment verification section */}
              <div className="border rounded-lg p-4 space-y-3">
                <h3 className="font-semibold">Payment Verification</h3>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Status:</span>
                  <Badge variant="outline" className={`capitalize ${paymentBadgeColor(selectedOrder.payment_status)}`}>
                    {selectedOrder.payment_status}
                  </Badge>
                </div>
                {selectedOrder.payment_reference && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reference:</span>
                    <span className="font-mono text-xs">{selectedOrder.payment_reference}</span>
                  </div>
                )}
                {selectedOrder.payment_proof_url && (
                  <div>
                    <p className="text-muted-foreground mb-2">Payment Proof:</p>
                    <a href={selectedOrder.payment_proof_url} target="_blank" rel="noopener noreferrer" className="block">
                      <img src={selectedOrder.payment_proof_url} alt="Payment proof" className="w-full rounded-lg border max-h-48 object-contain bg-muted" />
                    </a>
                  </div>
                )}
                {selectedOrder.payment_status === "pending_verification" && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => updatePaymentStatus.mutate({ id: selectedOrder.id, payment_status: "paid" })}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      onClick={() => updatePaymentStatus.mutate({ id: selectedOrder.id, payment_status: "rejected" })}
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                    </Button>
                  </div>
                )}
              </div>

              <div className="border-t pt-3">
                <p className="text-muted-foreground mb-2">Items:</p>
                {selectedOrder.order_items?.map((item: any) => (
                  <div key={item.id} className="flex justify-between py-1">
                    <span>{item.product_name} ×{item.quantity}</span>
                    <span>₦{(item.price * item.quantity).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-3 flex justify-between font-bold">
                <span>Total</span><span>₦{Number(selectedOrder.total).toLocaleString()}</span>
              </div>
              <div className="border-t pt-3 text-xs text-muted-foreground">
                <p>{selectedOrder.delivery_address}</p>
                <p>{selectedOrder.delivery_city}, {selectedOrder.delivery_state}</p>
                {selectedOrder.delivery_phone && <p>Phone: {selectedOrder.delivery_phone}</p>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
