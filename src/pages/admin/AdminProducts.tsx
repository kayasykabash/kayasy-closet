import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Upload, Search, Package, AlertTriangle, X } from "lucide-react";
import { MultiImageUploader, type ImageItem } from "@/components/admin/MultiImageUploader";

export default function AdminProducts() {
  const qc = useQueryClient();
  const [editProduct, setEditProduct] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");

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

  const filtered = products.filter((p: any) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h1 className="font-heading text-xl font-bold">Products ({products.length})</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => setEditProduct(null)}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editProduct ? "Edit Product" : "Add Product"}</DialogTitle>
              </DialogHeader>
              <ProductForm product={editProduct} categories={categories} onClose={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["admin-products"] }); }} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Products table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Product</th>
                <th className="text-left p-3 font-medium hidden sm:table-cell">Category</th>
                <th className="text-right p-3 font-medium">Price</th>
                <th className="text-right p-3 font-medium">Stock</th>
                <th className="text-right p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p: any) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                        {p.images?.[0] ? (
                          <img src={p.images[0]} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground sm:hidden">{p.category?.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 hidden sm:table-cell text-muted-foreground">{p.category?.name || "—"}</td>
                  <td className="p-3 text-right">₦{p.price.toLocaleString()}</td>
                  <td className="p-3 text-right">
                    <span className={p.stock <= 5 ? "text-amber-500 font-bold" : ""}>{p.stock}</span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => { setEditProduct(p); setShowForm(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete this product?")) deleteMutation.mutate(p.id); }}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No products found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

type VariantDraft = {
  id?: string;
  design_name: string;
  color: string;
  extra_price: string;
  stock: string;
  images: string[];
  newFiles: File[];
  _delete?: boolean;
};

function ProductForm({ product, categories, onClose }: { product: any; categories: any[]; onClose: () => void }) {
  const [form, setForm] = useState({
    name: product?.name || "",
    slug: product?.slug || "",
    description: product?.description || "",
    price: product?.price?.toString() || "",
    compare_at_price: product?.compare_at_price?.toString() || "",
    category_id: product?.category_id || "",
    sizes: product?.sizes?.join(", ") || "",
    colors: product?.colors?.join(", ") || "",
    stock: product?.stock?.toString() || "0",
    cost_price: product?.cost_price?.toString() || "0",
    is_featured: product?.is_featured || false,
  });
  const [productImages, setProductImages] = useState<ImageItem[]>(
    (product?.images || []).map((url: string) => ({ kind: "url" as const, url }))
  );
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [loading, setLoading] = useState(false);

  // Load existing variants
  useEffect(() => {
    if (!product?.id) return;
    supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", product.id)
      .order("sort_order")
      .then(({ data }) => {
        if (data) {
          setVariants(
            data.map((v: any) => ({
              id: v.id,
              design_name: v.design_name,
              color: v.color || "",
              extra_price: String(v.extra_price ?? 0),
              stock: String(v.stock ?? 0),
              images: v.images || [],
              newFiles: [],
            }))
          );
        }
      });
  }, [product?.id]);

  const uploadFiles = async (files: File[]): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of files) {
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
      urls.push(urlData.publicUrl);
    }
    return urls;
  };

  const addVariant = () =>
    setVariants(v => [...v, { design_name: "", color: "", extra_price: "0", stock: "0", images: [], newFiles: [] }]);
  const removeVariant = (idx: number) =>
    setVariants(vs => vs.map((v, i) => (i === idx ? { ...v, _delete: true } : v)));
  const updateVariant = (idx: number, patch: Partial<VariantDraft>) =>
    setVariants(vs => vs.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  const removeVariantImage = (idx: number, imgIdx: number) =>
    setVariants(vs => vs.map((v, i) => (i === idx ? { ...v, images: v.images.filter((_, k) => k !== imgIdx) } : v)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Upload any new files in productImages, keep order
      const filesToUpload = productImages.filter(i => i.kind === "file").map(i => (i as any).file as File);
      const uploadedUrls = filesToUpload.length > 0 ? await uploadFiles(filesToUpload) : [];
      let uploadCursor = 0;
      const images = productImages.map(it =>
        it.kind === "url" ? it.url : uploadedUrls[uploadCursor++]
      );
      const payload = {
        name: form.name,
        slug: form.slug || form.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
        description: form.description,
        price: parseFloat(form.price),
        compare_at_price: form.compare_at_price ? parseFloat(form.compare_at_price) : null,
        category_id: form.category_id || null,
        sizes: form.sizes ? form.sizes.split(",").map(s => s.trim()).filter(Boolean) : [],
        colors: form.colors ? form.colors.split(",").map(s => s.trim()).filter(Boolean) : [],
        designs: variants.filter(v => !v._delete).map(v => v.design_name).filter(Boolean),
        stock: parseInt(form.stock) || 0,
        cost_price: parseFloat(form.cost_price) || 0,
        is_featured: form.is_featured,
        images,
      };

      let productId = product?.id;
      if (product) {
        const { error } = await supabase.from("products").update(payload).eq("id", product.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("products").insert(payload).select().single();
        if (error) throw error;
        productId = data.id;
      }

      // Sync variants
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        if (v._delete) {
          if (v.id) await supabase.from("product_variants").delete().eq("id", v.id);
          continue;
        }
        if (!v.design_name.trim()) continue;
        const uploadedUrls = v.newFiles.length > 0 ? await uploadFiles(v.newFiles) : [];
        const variantPayload = {
          product_id: productId,
          design_name: v.design_name.trim(),
          color: v.color.trim() || null,
          extra_price: parseFloat(v.extra_price) || 0,
          stock: parseInt(v.stock) || 0,
          images: [...v.images, ...uploadedUrls],
          sort_order: i,
        };
        if (v.id) {
          const { error } = await supabase.from("product_variants").update(variantPayload).eq("id", v.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("product_variants").insert(variantPayload);
          if (error) throw error;
        }
      }

      toast.success(product ? "Product updated" : "Product created");
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const removeImage = (idx: number) => {
    setExistingImages(prev => prev.filter((_, i) => i !== idx));
  };

  const visibleVariants = variants.map((v, i) => ({ v, i })).filter(({ v }) => !v._delete);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
      <div><Label>Slug</Label><Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="auto-generated" /></div>
      <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Selling Price (₦)</Label><Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required /></div>
        <div><Label>Cost Price (₦)</Label><Input type="number" value={form.cost_price} onChange={e => setForm(f => ({ ...f, cost_price: e.target.value }))} placeholder="For profit tracking" /></div>
      </div>
      <div><Label>Compare-at Price (optional)</Label><Input type="number" value={form.compare_at_price} onChange={e => setForm(f => ({ ...f, compare_at_price: e.target.value }))} /></div>
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
      <div><Label>Colors (comma-separated, legacy)</Label><Input value={form.colors} onChange={e => setForm(f => ({ ...f, colors: e.target.value }))} placeholder="Use Variants below for designs" /></div>
      <div><Label>Base Stock (used when no variants)</Label><Input type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} /></div>

      {/* Default product images */}
      <div>
        <Label>Default Product Images</Label>
        {existingImages.length > 0 && (
          <div className="flex gap-2 mt-2 mb-2 flex-wrap">
            {existingImages.map((url, i) => (
              <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => removeImage(i)} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 text-xs flex items-center justify-center">×</button>
              </div>
            ))}
          </div>
        )}
        <label className="flex items-center gap-2 border border-dashed rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors">
          <Upload className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {imageFiles.length > 0 ? `${imageFiles.length} file(s) selected` : "Upload images"}
          </span>
          <input type="file" accept="image/*" multiple className="hidden" onChange={e => setImageFiles(Array.from(e.target.files || []))} />
        </label>
      </div>

      {/* Variants */}
      <div className="border rounded-lg p-3 bg-muted/20 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Product Variants / Designs</Label>
          <Button type="button" size="sm" variant="outline" onClick={addVariant}>
            <Plus className="h-3 w-3 mr-1" /> Add Design
          </Button>
        </div>
        {visibleVariants.length === 0 && (
          <p className="text-xs text-muted-foreground">No variants yet. Add designs like "Black Senator", "White Senator" — each with their own images, stock and price.</p>
        )}
        {visibleVariants.map(({ v, i }) => (
          <div key={i} className="border rounded-lg p-3 bg-card space-y-2 relative">
            <button
              type="button"
              onClick={() => removeVariant(i)}
              className="absolute top-2 right-2 text-destructive hover:bg-destructive/10 rounded p-1"
              aria-label="Remove design"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Design Name</Label>
                <Input value={v.design_name} onChange={e => updateVariant(i, { design_name: e.target.value })} placeholder="Black Senator" />
              </div>
              <div>
                <Label className="text-xs">Color</Label>
                <Input value={v.color} onChange={e => updateVariant(i, { color: e.target.value })} placeholder="Black" />
              </div>
              <div>
                <Label className="text-xs">Stock</Label>
                <Input type="number" value={v.stock} onChange={e => updateVariant(i, { stock: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Extra Price (₦)</Label>
                <Input type="number" value={v.extra_price} onChange={e => updateVariant(i, { extra_price: e.target.value })} />
              </div>
            </div>
            {parseInt(v.stock) > 0 && parseInt(v.stock) < 5 && (
              <p className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Low stock</p>
            )}
            <div>
              <Label className="text-xs">Images (front, back, side...)</Label>
              {v.images.length > 0 && (
                <div className="flex gap-2 mt-1 mb-1 flex-wrap">
                  {v.images.map((url, k) => (
                    <div key={k} className="relative w-12 h-12 rounded overflow-hidden border">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removeVariantImage(i, k)} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 text-[10px] flex items-center justify-center">×</button>
                    </div>
                  ))}
                </div>
              )}
              <label className="flex items-center gap-2 border border-dashed rounded p-2 cursor-pointer hover:bg-muted/50 transition-colors">
                <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {v.newFiles.length > 0 ? `${v.newFiles.length} new file(s)` : "Add images"}
                </span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={e => updateVariant(i, { newFiles: Array.from(e.target.files || []) })} />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input type="checkbox" checked={form.is_featured} onChange={e => setForm(f => ({ ...f, is_featured: e.target.checked }))} />
        <Label>Featured product</Label>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Saving..." : product ? "Update Product" : "Create Product"}
      </Button>
    </form>
  );
}
