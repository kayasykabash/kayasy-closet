import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, Users, Package } from "lucide-react";

export default function AdminAnalytics() {
  // Profit & Loss
  const { data: pl } = useQuery({
    queryKey: ["admin-pl"],
    queryFn: async () => {
      const [{ data: items }, { data: products }, { data: walkins }] = await Promise.all([
        supabase.from("order_items").select("product_id, quantity, price"),
        supabase.from("products").select("id, name, cost_price, price"),
        supabase.from("walkin_sales").select("product_id, quantity, unit_price, total_price"),
      ]);
      const costMap = new Map((products || []).map(p => [p.id, Number(p.cost_price || 0)]));
      let revenue = 0, cost = 0, walkinRevenue = 0;
      const productProfit: Record<string, { name: string; profit: number; sold: number }> = {};
      const accumulate = (productId: string, qty: number, lineRevenue: number) => {
        const c = (costMap.get(productId) || 0) * qty;
        revenue += lineRevenue;
        cost += c;
        const prod = products?.find(p => p.id === productId);
        if (prod) {
          if (!productProfit[productId]) productProfit[productId] = { name: prod.name, profit: 0, sold: 0 };
          productProfit[productId].profit += lineRevenue - c;
          productProfit[productId].sold += qty;
        }
      };
      (items || []).forEach((it: any) => accumulate(it.product_id, it.quantity, Number(it.price) * it.quantity));
      (walkins || []).forEach((w: any) => {
        walkinRevenue += Number(w.total_price);
        accumulate(w.product_id, w.quantity, Number(w.total_price));
      });
      const top = Object.values(productProfit).sort((a, b) => b.profit - a.profit).slice(0, 5);
      return {
        revenue,
        cost,
        profit: revenue - cost,
        margin: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0,
        topProducts: top,
        walkinRevenue,
        onlineRevenue: revenue - walkinRevenue,
      };
    },
  });

  // Top customers
  const { data: topCustomers = [] } = useQuery({
    queryKey: ["admin-top-customers"],
    queryFn: async () => {
      const [{ data: orders }, { data: profiles }] = await Promise.all([
        supabase.from("orders").select("user_id, total"),
        supabase.from("profiles").select("user_id, full_name, phone"),
      ]);
      const totals: Record<string, { spent: number; count: number }> = {};
      (orders || []).forEach((o: any) => {
        if (!totals[o.user_id]) totals[o.user_id] = { spent: 0, count: 0 };
        totals[o.user_id].spent += Number(o.total);
        totals[o.user_id].count += 1;
      });
      const profMap = new Map((profiles || []).map(p => [p.user_id, p]));
      return Object.entries(totals)
        .map(([uid, v]) => ({ ...v, profile: profMap.get(uid) as any, user_id: uid }))
        .sort((a, b) => b.spent - a.spent)
        .slice(0, 10);
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-xl font-bold">Analytics & Profit Insights</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card label="Revenue" value={`₦${(pl?.revenue || 0).toLocaleString()}`} icon={TrendingUp} color="text-green-500" bg="bg-green-500/10" />
        <Card label="Total Cost" value={`₦${(pl?.cost || 0).toLocaleString()}`} icon={TrendingDown} color="text-red-500" bg="bg-red-500/10" />
        <Card label="Net Profit" value={`₦${(pl?.profit || 0).toLocaleString()}`} icon={TrendingUp} color="text-primary" bg="bg-primary/10" />
        <Card label="Margin" value={`${(pl?.margin || 0).toFixed(1)}%`} icon={TrendingUp} color="text-amber-500" bg="bg-amber-500/10" />
      </div>

      <div className="bg-card border rounded-xl p-4">
        <h3 className="font-heading font-semibold text-sm mb-3">Revenue Split</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-xs text-muted-foreground">Online Orders</p>
            <p className="font-heading text-lg font-bold">₦{(pl?.onlineRevenue || 0).toLocaleString()}</p>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <p className="text-xs text-muted-foreground">Walk-in (POS)</p>
            <p className="font-heading text-lg font-bold">₦{(pl?.walkinRevenue || 0).toLocaleString()}</p>
          </div>
        </div>
      </div>

        <div className="bg-card border rounded-xl p-4">
          <h3 className="font-heading font-semibold text-sm mb-4 flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" /> Top Profitable Products
          </h3>
          {pl?.topProducts?.length ? (
            <div className="space-y-2">
              {pl.topProducts.map((p, i) => (
                <div key={i} className="flex justify-between items-center text-sm p-2 bg-muted/30 rounded-lg">
                  <span className="truncate">{p.name}</span>
                  <div className="text-right shrink-0 ml-2">
                    <p className="font-bold text-primary">₦{p.profit.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{p.sold} sold</p>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No data yet — add cost prices to products</p>}
        </div>

        <div className="bg-card border rounded-xl p-4">
          <h3 className="font-heading font-semibold text-sm mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Top Customers
          </h3>
          {topCustomers.length ? (
            <div className="space-y-2">
              {topCustomers.map((c: any, i) => (
                <div key={c.user_id} className="flex justify-between items-center text-sm p-2 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                    <span className="truncate">{c.profile?.full_name || "Customer"}</span>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="font-bold">₦{c.spent.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{c.count} orders</p>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No customers yet</p>}
        </div>
      </div>
    </div>
  );
}

function Card({ label, value, icon: Icon, color, bg }: any) {
  return (
    <div className="bg-card border rounded-xl p-4">
      <div className={`h-10 w-10 rounded-lg ${bg} flex items-center justify-center mb-2`}>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-heading text-lg font-bold mt-1">{value}</p>
    </div>
  );
}
