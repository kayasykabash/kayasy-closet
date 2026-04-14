import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Wrench, Megaphone, Tag, Plus, Trash2 } from "lucide-react";

export default function AdminSettings() {
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-xl font-bold">Settings</h1>
      <div className="grid lg:grid-cols-2 gap-6">
        <MaintenanceMode />
        <Announcements />
      </div>
      <PromoCodes />
    </div>
  );
}

function MaintenanceMode() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("*");
      const map: Record<string, any> = {};
      data?.forEach((s: any) => { map[s.key] = s.value; });
      return map;
    },
  });

  const toggle = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase.from("site_settings")
        .update({ value: { enabled } as any })
        .eq("key", "maintenance_mode");
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["site-settings"] }); toast.success("Maintenance mode updated"); },
    onError: (e: any) => toast.error(e.message),
  });

  const isEnabled = (settings?.maintenance_mode as any)?.enabled === true;

  return (
    <div className="bg-card border rounded-xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <Wrench className="h-5 w-5 text-primary" />
        <h3 className="font-heading font-semibold">Maintenance Mode</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        When enabled, the storefront will show a maintenance page to all visitors.
      </p>
      <div className="flex items-center gap-3">
        <Switch checked={isEnabled} onCheckedChange={v => toggle.mutate(v)} />
        <span className="text-sm font-medium">{isEnabled ? "Enabled" : "Disabled"}</span>
      </div>
    </div>
  );
}

function Announcements() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  const { data: announcements = [] } = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: async () => {
      const { data } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const createAnnouncement = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("announcements").insert({ title, message });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-announcements"] });
      setTitle(""); setMessage("");
      toast.success("Announcement created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteAnnouncement = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-announcements"] }); toast.success("Deleted"); },
  });

  return (
    <div className="bg-card border rounded-xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <Megaphone className="h-5 w-5 text-primary" />
        <h3 className="font-heading font-semibold">Announcements</h3>
      </div>
      <div className="space-y-3 mb-4">
        <Input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
        <Textarea placeholder="Message" value={message} onChange={e => setMessage(e.target.value)} rows={2} />
        <Button size="sm" onClick={() => createAnnouncement.mutate()} disabled={!title || !message}>
          <Plus className="h-4 w-4 mr-1" /> Post
        </Button>
      </div>
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {announcements.map((a: any) => (
          <div key={a.id} className="flex items-start justify-between gap-2 text-sm p-2 bg-muted/50 rounded-lg">
            <div>
              <p className="font-medium">{a.title}</p>
              <p className="text-xs text-muted-foreground">{a.message}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => deleteAnnouncement.mutate(a.id)}>
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PromoCodes() {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState("");
  const [usageLimit, setUsageLimit] = useState("");

  const { data: promos = [] } = useQuery({
    queryKey: ["admin-promos"],
    queryFn: async () => {
      const { data } = await supabase.from("promo_codes").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const createPromo = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("promo_codes").insert({
        code: code.toUpperCase(),
        discount_percent: parseFloat(discount),
        usage_limit: usageLimit ? parseInt(usageLimit) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-promos"] });
      setCode(""); setDiscount(""); setUsageLimit("");
      toast.success("Promo code created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const togglePromo = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("promo_codes").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-promos"] }); },
  });

  const deletePromo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("promo_codes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-promos"] }); toast.success("Deleted"); },
  });

  return (
    <div className="bg-card border rounded-xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <Tag className="h-5 w-5 text-primary" />
        <h3 className="font-heading font-semibold">Promo Codes</h3>
      </div>
      <div className="flex flex-wrap gap-3 mb-4">
        <Input placeholder="CODE" value={code} onChange={e => setCode(e.target.value)} className="w-32 uppercase" />
        <Input placeholder="Discount %" type="number" value={discount} onChange={e => setDiscount(e.target.value)} className="w-28" />
        <Input placeholder="Limit (optional)" type="number" value={usageLimit} onChange={e => setUsageLimit(e.target.value)} className="w-32" />
        <Button size="sm" onClick={() => createPromo.mutate()} disabled={!code || !discount}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 font-medium">Code</th>
              <th className="text-right py-2 font-medium">Discount</th>
              <th className="text-right py-2 font-medium">Used</th>
              <th className="text-center py-2 font-medium">Active</th>
              <th className="text-right py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {promos.map((p: any) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="py-2 font-mono font-medium">{p.code}</td>
                <td className="py-2 text-right">{p.discount_percent}%</td>
                <td className="py-2 text-right">{p.usage_count}{p.usage_limit ? `/${p.usage_limit}` : ""}</td>
                <td className="py-2 text-center">
                  <Switch checked={p.is_active} onCheckedChange={v => togglePromo.mutate({ id: p.id, active: v })} />
                </td>
                <td className="py-2 text-right">
                  <Button variant="ghost" size="sm" onClick={() => deletePromo.mutate(p.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
            {promos.length === 0 && (
              <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">No promo codes yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
