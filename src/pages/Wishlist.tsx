import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useWishlist } from "@/hooks/useWishlist";
import { useAuth } from "@/contexts/AuthContext";
import { ProductCard } from "@/components/ProductCard";
import { Heart } from "lucide-react";

const WishlistPage = () => {
  const { user } = useAuth();
  const { wishlistItems } = useWishlist();

  if (!user) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <p className="text-muted-foreground">Please sign in to view your wishlist.</p>
          <Link to="/auth" className="text-primary hover:underline">Sign In</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-6">
        <h1 className="font-heading text-2xl font-bold mb-6">My Wishlist ({wishlistItems.length})</h1>

        {wishlistItems.length === 0 ? (
          <div className="py-16 text-center">
            <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">Your wishlist is empty</p>
            <Link to="/shop" className="text-primary hover:underline">Explore Products</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {wishlistItems.map(item => (
              <ProductCard key={item.id} product={(item as any).product} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default WishlistPage;
