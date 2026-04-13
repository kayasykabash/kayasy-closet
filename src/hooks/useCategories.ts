import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("sort_order");
      if (error) throw error;
      const parents = data.filter(c => !c.parent_id);
      return parents.map(p => ({
        ...p,
        children: data.filter(c => c.parent_id === p.id),
      }));
    },
  });
}
