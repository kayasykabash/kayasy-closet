import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useDeliveryZones() {
  return useQuery({
    queryKey: ["delivery-zones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_zones")
        .select("*")
        .eq("is_active", true)
        .order("fee", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}
