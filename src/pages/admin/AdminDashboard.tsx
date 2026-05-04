import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package, ShoppingCart, Users, BarChart3, AlertTriangle, TrendingUp, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function AdminDashboard() {
  const { data: stats, refetch } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [products, orders, profiles, items, walkins] = await Promise.all([
        supabase.from("products").select("id, cost_price, price"),
        supabase.from("orders").select("id, total, created_at, status, payment_status, is_overdue"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("order_items").select("product_id, quantity, price"),
        supabase.from("walkin_sales").select("product_id, quantity, unit_price, total_price"),
      ]);
      const paidOrders = orders.data?.filter(o => o.payment_status === "paid") || [];
      const onlineRevenue = paidOrders.reduce((s, o) => s + Number(o.total), 0);
      const walkinRevenue = (walkins.data || []).reduce((s, w: any) => s + Number(w.total_price), 0);
      const totalRevenue = onlineRevenue + walkinRevenue;
      const costMap = new Map((products.data || []).map(p => [p.id, Number(p.cost_price || 0)]));
      let totalCost = 0;
      (items.data || []).forEach((it: any) => {
        totalCost += (costMap.get(it.product_id) || 0) * it.quantity;
      });
      (walkins.data || []).forEach((w: any) => {
        totalCost += (costMap.get(w.product_id) || 0) * w.quantity;
      });
      const overdueCount = (orders.data || []).filter(o => o.is_overdue && o.payment_status !== "paid").length;
      return {
        products: products.data?.length ?? 0,
        orders: orders.data?.length ?? 0,
        users: profiles.count ?? 0,
        revenue: totalRevenue,
        onlineRevenue,
        walkinRevenue,
        cost: totalCost,
        profit: totalRevenue - totalCost,
        overdue: overdueCount,
        recentOrders: orders.data?.slice(0, 5) || [],
      };
    },
  });

  const handleMarkOverdue = async () => {
    const { data, error } = await supabase.rpc("mark_overdue_orders");
    if (error) { toast.error(error.message); return; }
    toast.success(`Marked ${data ?? 0} order(s) as overdue`);
    refetch();
  };

  const { data: lowStock = [] } = useQuery({
    queryKey: ["admin-low-stock"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, stock").lte("stock", 5).order("stock");
      return data || [];
    },
  });

  const { data: salesChart = [] } = useQuery({
    queryKey: ["admin-sales-chart"],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("total, created_at").order("created_at", { ascending: true });
      if (!data?.length) return [];
      const byMonth: Record<string, number> = {};
      data.forEach(o => {
        const month = new Date(o.created_at).toLocaleDateString("en", { month: "short", year: "2-digit" });
        byMonth[month] = (byMonth[month] || 0) + Number(o.total);
      });
      return Object.entries(byMonth).map(([month, revenue]) => ({ month, revenue }));
    },
  });

  const cards = [
    { label: "Products", value: stats?.products || 0, icon: Package, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Orders", value: stats?.orders || 0, icon: ShoppingCart, color: "text-green-500", bg: "bg-green-500/10" },
    { label: "Customers", value: stats?.users || 0, icon: Users, color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Revenue", value: `₦${(stats?.revenue || 0).toLocaleString()}`, icon: BarChart3, color: "text-primary", bg: "bg-primary/10" },
    { label: "Net Profit", value: `₦${(stats?.profit || 0).toLocaleString()}`, icon: TrendingUp, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Overdue Orders", value: stats?.overdue || 0, icon: Clock, color: "text-destructive", bg: "bg-destructive/10" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h1 className="font-heading text-xl font-bold">Dashboard Overview</h1>
        <Button size="sm" variant="outline" onClick={handleMarkOverdue}>
          <Clock className="h-3.5 w-3.5 mr-1" /> Refresh Overdue
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {cards.map(c => (
          <div key={c.label} className="bg-card border rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className={`h-10 w-10 rounded-lg ${c.bg} flex items-center justify-center`}>
                <c.icon className={`h-5 w-5 ${c.color}`} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="font-heading text-xl font-bold mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Sales chart */}
        <div className="lg:col-span-2 bg-card border rounded-xl p-4">
          <h3 className="font-heading font-semibold text-sm mb-4">Sales Overview</h3>
          {salesChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={salesChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `₦${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => [`₦${v.toLocaleString()}`, "Revenue"]} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">No sales data yet</div>
          )}
        </div>

        {/* Low stock alerts */}
        <div className="bg-card border rounded-xl p-4">
          <h3 className="font-heading font-semibold text-sm mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Low Stock Alerts
          </h3>
          {lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground">All products are well-stocked</p>
          ) : (
            <div className="space-y-2">
              {lowStock.map((p: any) => (
                <div key={p.id} className="flex justify-between items-center text-sm p-2 bg-amber-500/5 rounded-lg">
                  <span className="truncate">{p.name}</span>
                  <span className="text-amber-500 font-bold ml-2">{p.stock}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent orders */}
      <div className="bg-card border rounded-xl p-4">
        <h3 className="font-heading font-semibold text-sm mb-4">Recent Orders</h3>
        {stats?.recentOrders?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 font-medium">Order ID</th>
                  <th className="text-left py-2 font-medium">Date</th>
                  <th className="text-left py-2 font-medium">Status</th>
                  <th className="text-right py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentOrders.map((o: any) => (
                  <tr key={o.id} className="border-b last:border-0">
                    <td className="py-2 font-mono text-xs">#{o.id.slice(0, 8)}</td>
                    <td className="py-2">{new Date(o.created_at).toLocaleDateString()}</td>
                    <td className="py-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        o.status === "delivered" ? "bg-green-500/10 text-green-500" :
                        o.status === "shipped" ? "bg-blue-500/10 text-blue-500" :
                        o.status === "cancelled" ? "bg-destructive/10 text-destructive" :
                        "bg-amber-500/10 text-amber-500"
                      }`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="py-2 text-right font-medium">₦{Number(o.total).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No orders yet</p>
        )}
      </div>
    </div>
  );
}
