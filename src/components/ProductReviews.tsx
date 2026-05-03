import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { toast } from "sonner";

interface Props {
  productId: string;
}

const StarRow = ({ value, onChange, size = 5 }: { value: number; onChange?: (n: number) => void; size?: number }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map(n => (
      <button
        key={n}
        type="button"
        disabled={!onChange}
        onClick={() => onChange?.(n)}
        className={onChange ? "cursor-pointer" : "cursor-default"}
      >
        <Star
          className={`h-${size} w-${size} ${n <= value ? "fill-primary text-primary" : "text-muted-foreground"}`}
        />
      </button>
    ))}
  </div>
);

export function ProductReviews({ productId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const { data: reviews = [] } = useQuery({
    queryKey: ["reviews", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: hasPurchased } = useQuery({
    queryKey: ["has-purchased", productId, user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("order_items")
        .select("id, orders!inner(user_id, status)")
        .eq("product_id", productId)
        .eq("orders.user_id", user.id);
      return (data?.length ?? 0) > 0;
    },
    enabled: !!user,
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in required");
      const { error } = await supabase.from("reviews").insert({
        product_id: productId,
        user_id: user.id,
        rating,
        comment: comment.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Review submitted");
      setComment("");
      setRating(5);
      qc.invalidateQueries({ queryKey: ["reviews", productId] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const alreadyReviewed = user && reviews.some(r => r.user_id === user.id);

  return (
    <div className="mt-12 border-t pt-8">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-heading text-xl font-bold">Customer Reviews</h2>
        {reviews.length > 0 && (
          <div className="flex items-center gap-2">
            <StarRow value={Math.round(avg)} />
            <span className="text-sm text-muted-foreground">
              {avg.toFixed(1)} • {reviews.length} review{reviews.length > 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {user && hasPurchased && !alreadyReviewed && (
        <div className="border rounded-lg p-4 mb-6 bg-card">
          <p className="text-sm font-medium mb-2">Leave a review</p>
          <div className="mb-2">
            <StarRow value={rating} onChange={setRating} />
          </div>
          <Textarea
            placeholder="Share your experience..."
            value={comment}
            onChange={e => setComment(e.target.value)}
            className="mb-2"
          />
          <Button size="sm" onClick={() => submit.mutate()} disabled={submit.isPending}>
            {submit.isPending ? "Submitting..." : "Submit Review"}
          </Button>
        </div>
      )}

      {!user && (
        <p className="text-sm text-muted-foreground mb-4">Sign in to leave a review.</p>
      )}
      {user && !hasPurchased && (
        <p className="text-sm text-muted-foreground mb-4">Only customers who purchased this item can review it.</p>
      )}

      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reviews yet. Be the first!</p>
      ) : (
        <div className="space-y-4">
          {reviews.map(r => (
            <div key={r.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-1">
                <StarRow value={r.rating} />
                <span className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
              </div>
              {r.comment && <p className="text-sm">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
