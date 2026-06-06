import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useProducts(options?: {
  categorySlug?: string;
  search?: string;
  featured?: boolean;
  limit?: number;
  sortBy?: string;
}) {
  return useQuery({
    queryKey: ["products", options],
    queryFn: async () => {
      let query = supabase.from("products").select("*, category:categories(*)");

      if (options?.categorySlug) {
        const { data: cat } = await supabase.from("categories").select("id").eq("slug", options.categorySlug).maybeSingle();
        if (cat) {
          // Get this category and its children
          const { data: childCats } = await supabase.from("categories").select("id").eq("parent_id", cat.id);
          const ids = [cat.id, ...(childCats?.map(c => c.id) || [])];
          query = query.in("category_id", ids);
        }
      }

      if (options?.search) {
        query = query.ilike("name", `%${options.search}%`);
      }

      if (options?.featured) {
        query = query.eq("is_featured", true);
      }

      if (options?.sortBy === "price-asc") query = query.order("price", { ascending: true });
      else if (options?.sortBy === "price-desc") query = query.order("price", { ascending: false });
      else if (options?.sortBy === "newest") query = query.order("created_at", { ascending: false });
      else query = query.order("created_at", { ascending: false });

      if (options?.limit) query = query.limit(options.limit);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useProduct(slug: string) {
  return useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, category:categories(*), variants:product_variants(*)")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (data && (data as any).variants) {
        (data as any).variants = [...(data as any).variants].sort(
          (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
        );
      }
      return data;
    },
    enabled: !!slug,
  });
}
