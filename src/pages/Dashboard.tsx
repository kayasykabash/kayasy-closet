import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingBag, Wallet, TrendingUp, MapPin, Package, CreditCard } from "lucide-react";
import { Link, Navigate } from "react-router-dom";

export default function DashboardPage() {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["user-dashboard", user?.id],
    queryFn: async () => {
      const [{ data: orders }, { data: profile }] = await Promise.all([
        supabase.from("orders").select("id, total, status, payment_status, created_at, is_overdue, due_date").order("created_at", { ascending: false }),
        supabase.from("profiles").select("*").eq("user_id", user!.id).maybeSingle(),
      ]);
      const totalSpent = (orders || []).filter(o => o.payment_status === "paid").reduce((s, o) => s + Number(o.total), 0);
      return {
        orders: orders || [],
        profile,
        totalOrders: orders?.length || 0,
        totalSpent,
        recent: (orders || []).slice(0, 5),
        overdue: (orders || []).filter(o => o.is_overdue && o.payment_status !== "paid"),
      };
    },
    enabled: !!user,
  });

  if (!user) return <Navigate to="/auth" replace />;

  const score = data?.profile?.credit_score ?? 100;
  const scoreColor = score >= 75 ? "text-green-500" : score >= 50 ? "text-amber-500" : "text-destructive";

  return (
    <Layout>
      <div className="container max-w-5xl py-6 space-y-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">Welcome back, {data?.profile?.full_name || "Customer"}</h1>
          <p className="text-sm text-muted-foreground">Here's an overview of your activity</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={ShoppingBag} label="Total Orders" value={data?.totalOrders || 0} color="text-blue-500" bg="bg-blue-500/10" />
          <StatCard icon={TrendingUp} label="Total Spent" value={`₦${(data?.totalSpent || 0).toLocaleString()}`} color="text-primary" bg="bg-primary/10" />
          <StatCard icon={Wallet} label="Credit Balance" value={`₦${Number(data?.profile?.credit_balance || 0).toLocaleString()}`} color="text-amber-500" bg="bg-amber-500/10" />
          <StatCard icon={CreditCard} label="Credit Score" value={`${score}/100`} color={scoreColor} bg={score >= 75 ? "bg-green-500/10" : score >= 50 ? "bg-amber-500/10" : "bg-destructive/10"} />
        </div>

        {/* Overdue alert */}
        {data?.overdue && data.overdue.length > 0 && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4">
            <p className="font-semibold text-destructive flex items-center gap-2"><Package className="h-4 w-4" /> {data.overdue.length} overdue payment(s)</p>
            <p className="text-xs text-muted-foreground mt-1">Settle outstanding balances to maintain your credit score.</p>
            <Link to="/orders" className="text-xs text-primary underline mt-2 inline-block">View orders →</Link>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-4">
          {/* Recent activity */}
          <div className="bg-card border rounded-xl p-4">
            <h2 className="font-heading font-semibold mb-3">Recent Activity</h2>
            {data?.recent?.length ? (
              <div className="space-y-2">
                {data.recent.map((o: any) => (
                  <Link key={o.id} to="/orders" className="flex justify-between items-center p-2 hover:bg-muted/30 rounded-lg text-sm">
                    <div>
                      <p className="font-mono text-xs">#{o.id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">₦{Number(o.total).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{o.status}</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No orders yet</p>}
          </div>

          {/* Quick links */}
          <div className="bg-card border rounded-xl p-4">
            <h2 className="font-heading font-semibold mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              <Link to="/orders" className="flex flex-col items-center gap-1 p-3 border rounded-lg hover:bg-muted/30">
                <ShoppingBag className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium">My Orders</span>
              </Link>
              <Link to="/addresses" className="flex flex-col items-center gap-1 p-3 border rounded-lg hover:bg-muted/30">
                <MapPin className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium">Addresses</span>
              </Link>
              <Link to="/wishlist" className="flex flex-col items-center gap-1 p-3 border rounded-lg hover:bg-muted/30">
                <Package className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium">Wishlist</span>
              </Link>
              <Link to="/shop" className="flex flex-col items-center gap-1 p-3 border rounded-lg hover:bg-muted/30">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium">Shop</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function StatCard({ icon: Icon, label, value, color, bg }: any) {
  return (
    <div className="bg-card border rounded-xl p-4">
      <div className={`h-9 w-9 rounded-lg ${bg} flex items-center justify-center mb-2`}>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}
