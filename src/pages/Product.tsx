import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useProduct } from "@/hooks/useProducts";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Heart, Minus, Plus, ShoppingCart, Truck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductReviews } from "@/components/ProductReviews";

const ProductPage = () => {
  const { slug } = useParams();
  const { data: product, isLoading } = useProduct(slug || "");
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { user } = useAuth();
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [selectedDesign, setSelectedDesign] = useState<string>("");
  const [quantity, setQuantity] = useState(1);

  if (isLoading) {
    return (
      <Layout>
        <div className="container py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Skeleton className="aspect-square rounded-lg" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!product) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <h1 className="font-heading text-2xl font-bold">Product Not Found</h1>
          <Link to="/shop" className="text-primary hover:underline mt-2 inline-block">Back to Shop</Link>
        </div>
      </Layout>
    );
  }

  const discount = product.compare_at_price
    ? Math.round(((product.compare_at_price - product.price) / product.compare_at_price) * 100)
    : 0;

  const handleAddToCart = () => {
    if (product.sizes && product.sizes.length > 0 && !selectedSize) return;
    if ((product as any).colors?.length > 0 && !selectedColor) return;
    if ((product as any).designs?.length > 0 && !selectedDesign) return;
    addToCart.mutate({
      productId: product.id,
      quantity,
      size: selectedSize || undefined,
      color: selectedColor || undefined,
      design: selectedDesign || undefined,
    });
  };

  return (
    <Layout>
      <div className="container py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-6">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <span>/</span>
          <Link to="/shop" className="hover:text-foreground">Shop</Link>
          <span>/</span>
          <span className="text-foreground">{product.name}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Image */}
          <div className="aspect-square rounded-lg overflow-hidden bg-muted">
            {product.images?.[0] ? (
              <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">No image available</div>
            )}
          </div>

          {/* Details */}
          <div>
            {product.category && (
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{(product.category as any).name}</p>
            )}
            <h1 className="font-heading text-2xl sm:text-3xl font-bold mb-3">{product.name}</h1>

            <div className="flex items-center gap-3 mb-4">
              <span className="font-heading text-2xl font-bold text-primary">₦{product.price.toLocaleString()}</span>
              {product.compare_at_price && (
                <>
                  <span className="text-lg text-muted-foreground line-through">₦{product.compare_at_price.toLocaleString()}</span>
                  <span className="bg-destructive/10 text-destructive text-xs font-bold px-2 py-0.5 rounded">-{discount}%</span>
                </>
              )}
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed mb-6">{product.description}</p>

            {/* Sizes */}
            {product.sizes && product.sizes.length > 0 && (
              <div className="mb-6">
                <Label className="text-sm font-medium mb-2 block">Size</Label>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map(size => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`px-3 py-1.5 border rounded text-sm transition-colors ${
                        selectedSize === size ? "border-primary bg-primary/10 text-primary font-medium" : "hover:border-foreground"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(product as any).colors?.length > 0 && (
              <div className="mb-6">
                <Label className="text-sm font-medium mb-2 block">Color</Label>
                <div className="flex flex-wrap gap-2">
                  {(product as any).colors.map((c: string) => (
                    <button key={c} onClick={() => setSelectedColor(c)}
                      className={`px-3 py-1.5 border rounded text-sm transition-colors ${
                        selectedColor === c ? "border-primary bg-primary/10 text-primary font-medium" : "hover:border-foreground"
                      }`}>{c}</button>
                  ))}
                </div>
              </div>
            )}

            {(product as any).designs?.length > 0 && (
              <div className="mb-6">
                <Label className="text-sm font-medium mb-2 block">Design</Label>
                <div className="flex flex-wrap gap-2">
                  {(product as any).designs.map((d: string) => (
                    <button key={d} onClick={() => setSelectedDesign(d)}
                      className={`px-3 py-1.5 border rounded text-sm transition-colors ${
                        selectedDesign === d ? "border-primary bg-primary/10 text-primary font-medium" : "hover:border-foreground"
                      }`}>{d}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="mb-6">
              <Label className="text-sm font-medium mb-2 block">Quantity</Label>
              <div className="flex items-center gap-3">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-2 border rounded hover:bg-muted">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="font-medium w-8 text-center">{quantity}</span>
                <button onClick={() => setQuantity(quantity + 1)} className="p-2 border rounded hover:bg-muted">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mb-6">
              <Button
                onClick={handleAddToCart}
                disabled={product.stock === 0 || addToCart.isPending || (product.sizes?.length > 0 && !selectedSize)}
                className="flex-1"
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                {product.stock === 0 ? "Out of Stock" : "Add to Cart"}
              </Button>
              {user && (
                <Button variant="outline" onClick={() => toggleWishlist.mutate(product.id)}>
                  <Heart className={`h-4 w-4 ${isInWishlist(product.id) ? "fill-destructive text-destructive" : ""}`} />
                </Button>
              )}
            </div>

            {/* Shipping info */}
            <div className="border rounded-lg p-4 space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" />
                <span>Free delivery on orders over ₦50,000</span>
              </div>
              <p>Stock: {product.stock > 0 ? `${product.stock} available` : "Out of stock"}</p>
            </div>
          </div>
        </div>

        <ProductReviews productId={product.id} />
      </div>
    </Layout>
  );
};

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={className}>{children}</label>;
}

export default ProductPage;
