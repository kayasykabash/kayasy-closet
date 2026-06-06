import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useCart() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: cartItems = [], isLoading } = useQuery({
    queryKey: ["cart", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("cart_items")
        .select("*, product:products(*), variant:product_variants(*)")
        .eq("user_id", user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const addToCart = useMutation({
    mutationFn: async ({ productId, quantity = 1, size, color, design, variantId, variantImage }: { productId: string; quantity?: number; size?: string; color?: string; design?: string; variantId?: string; variantImage?: string }) => {
      if (!user) throw new Error("Please sign in");
      const existing = cartItems.find((i: any) => i.product_id === productId && i.size === size && i.color === color && i.design === design && i.variant_id === (variantId ?? null));
      if (existing) {
        const { error } = await supabase.from("cart_items").update({ quantity: existing.quantity + quantity }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cart_items").insert({ user_id: user.id, product_id: productId, quantity, size, color, design, variant_id: variantId ?? null, variant_image: variantImage ?? null } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cart"] }); toast.success("Added to cart"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateQuantity = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      if (quantity <= 0) {
        await supabase.from("cart_items").delete().eq("id", id);
      } else {
        await supabase.from("cart_items").update({ quantity }).eq("id", id);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }),
  });

  const clearCart = useMutation({
    mutationFn: async () => {
      if (!user) return;
      await supabase.from("cart_items").delete().eq("user_id", user.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }),
  });

  const total = cartItems.reduce((sum, item) => {
    const price = (item as any).product?.price ?? 0;
    return sum + price * item.quantity;
  }, 0);

  return { cartItems, isLoading, addToCart, updateQuantity, clearCart, total, count: cartItems.length };
}
