import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Package, ShoppingCart, Users, BarChart3, Plus, Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

const AdminPage = () => {
  const { isAdmin, loading } = useAuth();

  if (loading) return <Layout><div className="container py-16 text-center">Loading...</div></Layout>;
  if (!isAdmin) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <h1 className="font-heading text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You need admin privileges to access this page.</p>
          <Link to="/" className="text-primary hover:underline mt-2 inline-block">Go Home</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-6">
        <h1 className="font-heading text-2xl font-bold mb-6">Admin Dashboard</h1>
        <AdminStats />
        <Tabs defaultValue="products" className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
          </TabsList>
          <TabsContent value="products"><AdminProducts /></TabsContent>
          <TabsContent value="orders"><AdminOrders /></TabsContent>
          <TabsContent value="categories"><AdminCategories /></TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

function AdminStats() {
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [products, orders, users] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("id, total"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);
      const totalRevenue = orders.data?.reduce((s, o) => s + Number(o.total), 0) || 0;
      return {
        products: products.count || 0,
        orders: orders.data?.length || 0,
        users: users.count || 0,
        revenue: totalRevenue,
      };
    },
  });

  const cards = [
    { label: "Products", value: stats?.products || 0, icon: Package, color: "text-blue-500" },
    { label: "Orders", value: stats?.orders || 0, icon: ShoppingCart, color: "text-green-500" },
    { label: "Customers", value: stats?.users || 0, icon: Users, color: "text-purple-500" },
    { label: "Revenue", value: `₦${(stats?.revenue || 0).toLocaleString()}`, icon: BarChart3, color: "text-primary" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map(c => (
        <div key={c.label} className="border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-2 mb-1">
            <c.icon className={`h-4 w-4 ${c.color}`} />
            <span className="text-xs text-muted-foreground">{c.label}</span>
          </div>
          <p className="font-heading text-lg font-bold">{c.value}</p>
        </div>
      ))}
    </div>
  );
}

function AdminProducts() {
  const qc = useQueryClient();
  const [editProduct, setEditProduct] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*, category:categories(name)").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").order("sort_order");
      return data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-products"] }); toast.success("Product deleted"); },
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-heading font-semibold">Products ({products.length})</h2>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => setEditProduct(null)}><Plus className="h-4 w-4 mr-1" /> Add Product</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editProduct ? "Edit Product" : "Add Product"}</DialogTitle></DialogHeader>
            <ProductForm product={editProduct} categories={categories} onClose={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["admin-products"] }); }} />
          </DialogContent>
        </Dialog>
      </div>
      <div className="space-y-2">
        {products.map((p: any) => (
          <div key={p.id} className="flex items-center gap-3 border rounded-lg p-3 bg-card">
            <div className="w-12 h-12 bg-muted rounded overflow-hidden flex-shrink-0">
              {p.images?.[0] && <img src={p.images[0]} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{p.name}</p>
              <p className="text-xs text-muted-foreground">{p.category?.name} · ₦{p.price.toLocaleString()} · Stock: {p.stock}</p>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => { setEditProduct(p); setShowForm(true); }}><Pencil className="h-3 w-3" /></Button>
              <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(p.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductForm({ product, categories, onClose }: { product: any; categories: any[]; onClose: () => void }) {
  const [form, setForm] = useState({
    name: product?.name || "",
    slug: product?.slug || "",
    description: product?.description || "",
    price: product?.price?.toString() || "",
    compare_at_price: product?.compare_at_price?.toString() || "",
    category_id: product?.category_id || "",
    sizes: product?.sizes?.join(", ") || "",
    stock: product?.stock?.toString() || "0",
    is_featured: product?.is_featured || false,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const payload = {
      name: form.name,
      slug: form.slug || form.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
      description: form.description,
      price: parseFloat(form.price),
      compare_at_price: form.compare_at_price ? parseFloat(form.compare_at_price) : null,
      category_id: form.category_id || null,
      sizes: form.sizes ? form.sizes.split(",").map(s => s.trim()) : [],
      stock: parseInt(form.stock) || 0,
      is_featured: form.is_featured,
    };

    try {
      if (product) {
        const { error } = await supabase.from("products").update(payload).eq("id", product.id);
        if (error) throw error;
        toast.success("Product updated");
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
        toast.success("Product created");
      }
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
      <div><Label>Slug</Label><Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="auto-generated" /></div>
      <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Price (₦)</Label><Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required /></div>
        <div><Label>Compare Price</Label><Input type="number" value={form.compare_at_price} onChange={e => setForm(f => ({ ...f, compare_at_price: e.target.value }))} /></div>
      </div>
      <div>
        <Label>Category</Label>
        <Select value={form.category_id} onValueChange={v => setForm(f => ({ ...f, category_id: v }))}>
          <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
          <SelectContent>
            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div><Label>Sizes (comma-separated)</Label><Input value={form.sizes} onChange={e => setForm(f => ({ ...f, sizes: e.target.value }))} placeholder="S, M, L, XL" /></div>
      <div><Label>Stock</Label><Input type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} /></div>
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={form.is_featured} onChange={e => setForm(f => ({ ...f, is_featured: e.target.checked }))} />
        <Label>Featured product</Label>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>{loading ? "Saving..." : product ? "Update" : "Create"}</Button>
    </form>
  );
}

function AdminOrders() {
  const qc = useQueryClient();

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

  const statusOptions = ["pending", "processing", "shipped", "delivered", "cancelled"];

  return (
    <div className="space-y-3">
      <h2 className="font-heading font-semibold">Orders ({orders.length})</h2>
      {orders.map((order: any) => (
        <div key={order.id} className="border rounded-lg p-4 bg-card">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-medium">#{order.id.slice(0, 8)}</p>
              <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString()}</p>
            </div>
            <Select value={order.status} onValueChange={v => updateStatus.mutate({ id: order.id, status: v })}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {statusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm space-y-1">
            {order.order_items?.map((item: any) => (
              <p key={item.id}>{item.product_name} x{item.quantity} — ₦{(item.price * item.quantity).toLocaleString()}</p>
            ))}
          </div>
          <div className="border-t mt-2 pt-2 flex justify-between text-sm font-bold">
            <span>Total</span><span>₦{Number(order.total).toLocaleString()}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{order.delivery_address}, {order.delivery_city}, {order.delivery_state}</p>
        </div>
      ))}
    </div>
  );
}

function AdminCategories() {
  const { data: categories = [] } = useQuery({
    queryKey: ["admin-categories-full"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").order("sort_order");
      return data || [];
    },
  });

  const parents = categories.filter(c => !c.parent_id);

  return (
    <div className="space-y-3">
      <h2 className="font-heading font-semibold">Categories</h2>
      {parents.map(p => (
        <div key={p.id} className="border rounded-lg p-4 bg-card">
          <h3 className="font-medium text-sm">{p.name}</h3>
          <div className="flex flex-wrap gap-1 mt-2">
            {categories.filter(c => c.parent_id === p.id).map(sub => (
              <Badge key={sub.id} variant="secondary" className="text-xs">{sub.name}</Badge>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default AdminPage;
