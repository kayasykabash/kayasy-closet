import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { History, ArrowDown, ArrowUp, Plus } from "lucide-react";

export default function AdminStockHistory() {
  const { data: movements = [] } = useQuery({
    queryKey: ["admin-stock-movements"],
    queryFn: async () => {
      const [{ data: moves }, { data: products }] = await Promise.all([
        supabase.from("stock_movements").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("products").select("id, name"),
      ]);
      const map = new Map((products || []).map(p => [p.id, p.name]));
      return (moves || []).map((m: any) => ({ ...m, product_name: map.get(m.product_id) || "Unknown" }));
    },
  });

  const iconFor = (action: string) => {
    if (action === "sold") return <ArrowDown className="h-3.5 w-3.5 text-red-500" />;
    if (action === "created") return <Plus className="h-3.5 w-3.5 text-blue-500" />;
    return <ArrowUp className="h-3.5 w-3.5 text-green-500" />;
  };

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-xl font-bold flex items-center gap-2">
        <History className="h-5 w-5" /> Stock Movement History
      </h1>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">When</th>
                <th className="text-left p-3 font-medium">Product</th>
                <th className="text-left p-3 font-medium">Action</th>
                <th className="text-right p-3 font-medium">Change</th>
                <th className="text-right p-3 font-medium hidden sm:table-cell">New Stock</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Reason</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m: any) => (
                <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(m.created_at).toLocaleString()}</td>
                  <td className="p-3 truncate max-w-[150px]">{m.product_name}</td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1 text-xs">
                      {iconFor(m.action)} {m.action}
                    </span>
                  </td>
                  <td className={`p-3 text-right font-medium ${m.quantity_change < 0 ? "text-red-500" : "text-green-500"}`}>
                    {m.quantity_change > 0 ? "+" : ""}{m.quantity_change}
                  </td>
                  <td className="p-3 text-right hidden sm:table-cell">{m.new_stock ?? "—"}</td>
                  <td className="p-3 text-xs text-muted-foreground hidden md:table-cell truncate max-w-[200px]">{m.reason || "—"}</td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No stock movements yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
