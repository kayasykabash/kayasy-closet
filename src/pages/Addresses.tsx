import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { MapPin, Plus, Pencil, Trash2, Star } from "lucide-react";
import { Navigate } from "react-router-dom";

export default function AddressesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [edit, setEdit] = useState<any>(null);
  const [open, setOpen] = useState(false);

  const { data: addresses = [] } = useQuery({
    queryKey: ["addresses", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_addresses").select("*").order("is_default", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const setDefault = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("user_addresses").update({ is_default: false }).eq("user_id", user!.id);
      const { error } = await supabase.from("user_addresses").update({ is_default: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["addresses"] }); toast.success("Default address updated"); },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_addresses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["addresses"] }); toast.success("Address removed"); },
  });

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <Layout>
      <div className="container max-w-3xl py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="font-heading text-2xl font-bold">My Addresses</h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => setEdit(null)}><Plus className="h-4 w-4 mr-1" /> Add</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{edit ? "Edit Address" : "Add Address"}</DialogTitle></DialogHeader>
              <AddressForm address={edit} userId={user.id} onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["addresses"] }); }} />
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {addresses.map((a: any) => (
            <div key={a.id} className="bg-card border rounded-xl p-4 relative">
              {a.is_default && (
                <span className="absolute top-3 right-3 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <Star className="h-3 w-3 fill-primary" /> Default
                </span>
              )}
              <div className="flex items-start gap-2 mb-2">
                <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold">{a.label || "Home"}</p>
                  <p className="text-xs text-muted-foreground">{a.full_name}</p>
                </div>
              </div>
              <div className="text-sm text-muted-foreground space-y-0.5 mb-3">
                <p>{a.address}</p>
                <p>{a.city}, {a.state}</p>
                <p>{a.phone}</p>
              </div>
              <div className="flex gap-1">
                {!a.is_default && (
                  <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setDefault.mutate(a.id)}>
                    Set default
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => { setEdit(a); setOpen(true); }}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => { if (confirm("Delete this address?")) remove.mutate(a.id); }}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          {addresses.length === 0 && (
            <p className="text-center text-muted-foreground py-12 col-span-full">No saved addresses yet. Add one to checkout faster!</p>
          )}
        </div>
      </div>
    </Layout>
  );
}

function AddressForm({ address, userId, onClose }: any) {
  const [form, setForm] = useState({
    label: address?.label || "Home",
    full_name: address?.full_name || "",
    phone: address?.phone || "",
    address: address?.address || "",
    city: address?.city || "",
    state: address?.state || "",
    is_default: address?.is_default ?? false,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (form.is_default) {
        await supabase.from("user_addresses").update({ is_default: false }).eq("user_id", userId);
      }
      if (address) {
        const { error } = await supabase.from("user_addresses").update(form).eq("id", address.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_addresses").insert({ ...form, user_id: userId });
        if (error) throw error;
      }
      toast.success("Address saved");
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div><Label>Label (e.g. Home, Office)</Label><Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Full Name</Label><Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required /></div>
        <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} required /></div>
      </div>
      <div><Label>Address</Label><Textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} required /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>City</Label><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} required /></div>
        <div><Label>State</Label><Input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} required /></div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.is_default} onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))} />
        Set as default address
      </label>
      <Button type="submit" className="w-full" disabled={loading}>{loading ? "Saving..." : "Save Address"}</Button>
    </form>
  );
}
