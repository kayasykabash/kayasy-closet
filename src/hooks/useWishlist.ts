import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useWishlist() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: wishlistItems = [] } = useQuery({
    queryKey: ["wishlist", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from("wishlist_items").select("*, product:products(*)").eq("user_id", user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const toggleWishlist = useMutation({
    mutationFn: async (productId: string) => {
      if (!user) throw new Error("Please sign in");
      const exists = wishlistItems.find(i => i.product_id === productId);
      if (exists) {
        await supabase.from("wishlist_items").delete().eq("id", exists.id);
      } else {
        await supabase.from("wishlist_items").insert({ user_id: user.id, product_id: productId });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["wishlist"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const isInWishlist = (productId: string) => wishlistItems.some(i => i.product_id === productId);

  return { wishlistItems, toggleWishlist, isInWishlist };
}
