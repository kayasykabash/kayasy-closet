import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, MapPin, Trash2, Pencil } from "lucide-react";

export default function AdminDeliveryZones() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<any>(null);
  const [open, setOpen] = useState(false);

  const { data: zones = [] } = useQuery({
    queryKey: ["admin-zones"],
    queryFn: async () => {
      const { data } = await supabase.from("delivery_zones").select("*").order("fee");
      return data || [];
    },
  });

  const deleteZone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("delivery_zones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-zones"] }); toast.success("Zone deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="font-heading text-xl font-bold">Delivery Zones</h1>
          <p className="text-xs text-muted-foreground">{zones.length} active zones</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => setEdit(null)}><Plus className="h-4 w-4 mr-1" /> Add Zone</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{edit ? "Edit Zone" : "Add Delivery Zone"}</DialogTitle></DialogHeader>
            <ZoneForm zone={edit} onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["admin-zones"] }); }} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {zones.map((z: any) => (
          <div key={z.id} className="bg-card border rounded-xl p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <h3 className="font-heading font-semibold">{z.name}</h3>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${z.is_active ? "bg-green-500/10 text-green-600" : "bg-muted"}`}>
                {z.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              {[z.city, z.state].filter(Boolean).join(", ") || "Nationwide"}
            </p>
            <p className="font-bold text-primary text-lg">₦{Number(z.fee).toLocaleString()}</p>
            <div className="flex gap-1 mt-3">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => { setEdit(z); setOpen(true); }}>
                <Pencil className="h-3 w-3 mr-1" /> Edit
              </Button>
              <Button variant="outline" size="sm" onClick={() => { if (confirm("Delete this zone?")) deleteZone.mutate(z.id); }}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        {zones.length === 0 && <p className="text-muted-foreground text-sm col-span-full text-center py-8">No zones yet — add your first one</p>}
      </div>
    </div>
  );
}

function ZoneForm({ zone, onClose }: { zone: any; onClose: () => void }) {
  const [form, setForm] = useState({
    name: zone?.name || "",
    state: zone?.state || "",
    city: zone?.city || "",
    fee: zone?.fee?.toString() || "0",
    is_active: zone?.is_active ?? true,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form, fee: parseFloat(form.fee) || 0 };
      if (zone) {
        const { error } = await supabase.from("delivery_zones").update(payload).eq("id", zone.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("delivery_zones").insert(payload);
        if (error) throw error;
      }
      toast.success("Zone saved");
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div><Label>Zone Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Biu, Maiduguri" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>State</Label><Input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} /></div>
        <div><Label>City</Label><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
      </div>
      <div><Label>Delivery Fee (₦)</Label><Input type="number" value={form.fee} onChange={e => setForm(f => ({ ...f, fee: e.target.value }))} required /></div>
      <div className="flex items-center justify-between p-3 border rounded-lg">
        <Label>Active</Label>
        <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>{loading ? "Saving..." : "Save Zone"}</Button>
    </form>
  );
}
