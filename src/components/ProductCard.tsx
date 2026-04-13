import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { useWishlist } from "@/hooks/useWishlist";
import { useAuth } from "@/contexts/AuthContext";

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    compare_at_price?: number | null;
    images: string[];
    category?: { name: string } | null;
    rating?: number | null;
    stock: number;
  };
}

export function ProductCard({ product }: ProductCardProps) {
  const { user } = useAuth();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const wishlisted = isInWishlist(product.id);
  const discount = product.compare_at_price
    ? Math.round(((product.compare_at_price - product.price) / product.compare_at_price) * 100)
    : 0;

  return (
    <div className="group relative rounded-lg border bg-card overflow-hidden transition-shadow hover:shadow-lg animate-fade-in">
      {/* Image */}
      <Link to={`/product/${product.slug}`} className="block aspect-[3/4] bg-muted relative overflow-hidden">
        {product.images?.[0] ? (
          <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">No image</div>
        )}
        {discount > 0 && (
          <span className="absolute top-2 left-2 bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-0.5 rounded">
            -{discount}%
          </span>
        )}
        {product.stock === 0 && (
          <div className="absolute inset-0 bg-foreground/50 flex items-center justify-center">
            <span className="bg-card text-foreground text-xs font-semibold px-3 py-1 rounded">Out of Stock</span>
          </div>
        )}
      </Link>

      {/* Wishlist */}
      {user && (
        <button
          onClick={() => toggleWishlist.mutate(product.id)}
          className="absolute top-2 right-2 p-1.5 rounded-full bg-card/80 backdrop-blur hover:bg-card transition-colors"
        >
          <Heart className={`h-4 w-4 ${wishlisted ? "fill-destructive text-destructive" : "text-muted-foreground"}`} />
        </button>
      )}

      {/* Info */}
      <div className="p-3">
        {product.category && (
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{(product.category as any).name}</p>
        )}
        <Link to={`/product/${product.slug}`}>
          <h3 className="text-sm font-medium line-clamp-2 hover:text-primary transition-colors">{product.name}</h3>
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <span className="font-heading font-bold text-sm">₦{product.price.toLocaleString()}</span>
          {product.compare_at_price && (
            <span className="text-xs text-muted-foreground line-through">₦{product.compare_at_price.toLocaleString()}</span>
          )}
        </div>
      </div>
    </div>
  );
}
