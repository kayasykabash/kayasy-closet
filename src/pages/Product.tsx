import { useParams, Link } from "react-router-dom";
import { useState, useMemo, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { useProduct } from "@/hooks/useProducts";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Heart, Minus, Plus, ShoppingCart, Truck, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductReviews } from "@/components/ProductReviews";

const ProductPage = () => {
  const { slug } = useParams();
  const { data: product, isLoading } = useProduct(slug || "");
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { user } = useAuth();
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [activeImage, setActiveImage] = useState<string>("");
  const [quantity, setQuantity] = useState(1);

  const variants = (product as any)?.variants as any[] | undefined;
  const hasVariants = Array.isArray(variants) && variants.length > 0;

  const selectedVariant = useMemo(
    () => (hasVariants ? variants!.find(v => v.id === selectedVariantId) : null),
    [hasVariants, variants, selectedVariantId]
  );

  // Initial variant + image
  useEffect(() => {
    if (!product) return;
    if (hasVariants && !selectedVariantId) {
      const first = variants![0];
      setSelectedVariantId(first.id);
      setActiveImage(first.images?.[0] || product.images?.[0] || "");
    } else if (!hasVariants && !activeImage) {
      setActiveImage(product.images?.[0] || "");
    }
  }, [product, hasVariants, variants, selectedVariantId, activeImage]);

  // When variant changes, swap image
  useEffect(() => {
    if (selectedVariant) {
      setActiveImage(selectedVariant.images?.[0] || product?.images?.[0] || "");
      setQuantity(1);
    }
  }, [selectedVariantId]);

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

  const effectivePrice = product.price + Number(selectedVariant?.extra_price || 0);
  const effectiveStock = selectedVariant ? selectedVariant.stock : product.stock;
  const discount = product.compare_at_price
    ? Math.round(((product.compare_at_price - product.price) / product.compare_at_price) * 100)
    : 0;

  const gallery: string[] = selectedVariant?.images?.length
    ? selectedVariant.images
    : (product.images || []);

  const handleAddToCart = () => {
    if (hasVariants && !selectedVariantId) return;
    if (product.sizes && product.sizes.length > 0 && !selectedSize) return;
    addToCart.mutate({
      productId: product.id,
      quantity,
      size: selectedSize || undefined,
      color: selectedVariant?.color || undefined,
      design: selectedVariant?.design_name || undefined,
      variantId: selectedVariantId || undefined,
      variantImage: activeImage || undefined,
    });
  };

  return (
    <Layout>
      <div className="container py-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-6">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <span>/</span>
          <Link to="/shop" className="hover:text-foreground">Shop</Link>
          <span>/</span>
          <span className="text-foreground">{product.name}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Gallery */}
          <div className="space-y-3">
            <div className="aspect-square rounded-lg overflow-hidden bg-muted">
              {activeImage ? (
                <img
                  key={activeImage}
                  src={activeImage}
                  alt={product.name}
                  loading="eager"
                  decoding="async"
                  className="h-full w-full object-cover animate-in fade-in duration-300"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">No image available</div>
              )}
            </div>
            {gallery.length > 1 && (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {gallery.map((img, i) => (
                  <button
                    key={img + i}
                    type="button"
                    onClick={() => setActiveImage(img)}
                    className={`aspect-square rounded-md overflow-hidden border-2 transition-colors ${
                      activeImage === img ? "border-primary" : "border-transparent hover:border-muted-foreground/40"
                    }`}
                    aria-label={`View image ${i + 1}`}
                  >
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div>
            {product.category && (
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{(product.category as any).name}</p>
            )}
            <h1 className="font-heading text-2xl sm:text-3xl font-bold mb-3">{product.name}</h1>

            <div className="flex items-center gap-3 mb-4">
              <span className="font-heading text-2xl font-bold text-primary">₦{effectivePrice.toLocaleString()}</span>
              {product.compare_at_price && !selectedVariant?.extra_price && (
                <>
                  <span className="text-lg text-muted-foreground line-through">₦{product.compare_at_price.toLocaleString()}</span>
                  <span className="bg-destructive/10 text-destructive text-xs font-bold px-2 py-0.5 rounded">-{discount}%</span>
                </>
              )}
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed mb-6">{product.description}</p>

            {/* Variants / Designs */}
            {hasVariants && (
              <div className="mb-6">
                <label className="text-sm font-medium mb-2 block">
                  Design{selectedVariant ? `: ${selectedVariant.design_name}${selectedVariant.color ? ` · ${selectedVariant.color}` : ""}` : ""}
                </label>
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                  {variants!.map(v => {
                    const thumb = v.images?.[0];
                    const isSel = v.id === selectedVariantId;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVariantId(v.id)}
                        className={`flex-shrink-0 w-20 rounded-lg border-2 overflow-hidden transition-all ${
                          isSel ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-muted-foreground/40"
                        }`}
                        aria-label={v.design_name}
                        aria-pressed={isSel}
                      >
                        <div className="aspect-square bg-muted">
                          {thumb ? (
                            <img src={thumb} alt={v.design_name} className="h-full w-full object-cover" />
                          ) : (
                            <div
                              className="h-full w-full"
                              style={{ background: v.color || "hsl(var(--muted))" }}
                            />
                          )}
                        </div>
                        <p className="text-[10px] font-medium truncate px-1 py-1 leading-tight">{v.design_name}</p>
                      </button>
                    );
                  })}
                </div>
                {selectedVariant && selectedVariant.stock < 5 && selectedVariant.stock > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-2 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Only {selectedVariant.stock} left
                  </p>
                )}
              </div>
            )}

            {/* Sizes */}
            {product.sizes && product.sizes.length > 0 && (
              <div className="mb-6">
                <label className="text-sm font-medium mb-2 block">Size</label>
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

            {/* Quantity */}
            <div className="mb-6">
              <label className="text-sm font-medium mb-2 block">Quantity</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-2 border rounded hover:bg-muted" aria-label="Decrease quantity">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="font-medium w-8 text-center">{quantity}</span>
                <button onClick={() => setQuantity(Math.min(effectiveStock || 99, quantity + 1))} className="p-2 border rounded hover:bg-muted" aria-label="Increase quantity">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mb-6">
              <Button
                onClick={handleAddToCart}
                disabled={
                  effectiveStock === 0 ||
                  addToCart.isPending ||
                  (hasVariants && !selectedVariantId) ||
                  (product.sizes?.length > 0 && !selectedSize)
                }
                className="flex-1"
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                {effectiveStock === 0 ? "Out of Stock" : "Add to Cart"}
              </Button>
              {user && (
                <Button variant="outline" onClick={() => toggleWishlist.mutate(product.id)} aria-label="Toggle wishlist">
                  <Heart className={`h-4 w-4 ${isInWishlist(product.id) ? "fill-destructive text-destructive" : ""}`} />
                </Button>
              )}
            </div>

            <div className="border rounded-lg p-4 space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" />
                <span>Free delivery on orders over ₦50,000</span>
              </div>
              <p>Stock: {effectiveStock > 0 ? `${effectiveStock} available` : "Out of stock"}</p>
            </div>
          </div>
        </div>

        <ProductReviews productId={product.id} />
      </div>
    </Layout>
  );
};

export default ProductPage;
