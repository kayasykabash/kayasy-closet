import { Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";

const CartPage = () => {
  const { cartItems, isLoading, updateQuantity, total } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h1 className="font-heading text-2xl font-bold mb-2">Your Cart</h1>
          <p className="text-muted-foreground mb-4">Sign in to view your cart</p>
          <Link to="/auth"><Button>Sign In</Button></Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-6">
        <h1 className="font-heading text-2xl font-bold mb-6">Shopping Cart ({cartItems.length})</h1>

        {cartItems.length === 0 ? (
          <div className="py-16 text-center">
            <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">Your cart is empty</p>
            <Link to="/shop"><Button>Continue Shopping</Button></Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cart items */}
            <div className="lg:col-span-2 space-y-3">
              {cartItems.map(item => {
                const product = (item as any).product;
                const variant = (item as any).variant;
                const img = (item as any).variant_image || variant?.images?.[0] || product?.images?.[0];
                const unit = (product?.price || 0) + Number(variant?.extra_price || 0);
                return (
                  <div key={item.id} className="flex gap-4 p-4 border rounded-lg bg-card">
                    <Link to={`/product/${product?.slug}`} className="w-20 h-20 bg-muted rounded overflow-hidden flex-shrink-0">
                      {img ? (
                        <img src={img} alt={product?.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No img</div>
                      )}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium truncate">{product?.name}</h3>
                      {variant?.design_name && (
                        <p className="text-xs text-muted-foreground">Design: {variant.design_name}{variant.color ? ` · ${variant.color}` : ""}</p>
                      )}
                      {item.size && <p className="text-xs text-muted-foreground">Size: {item.size}</p>}
                      <p className="font-heading font-bold text-sm mt-1">₦{unit.toLocaleString()}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <button onClick={() => updateQuantity.mutate({ id: item.id, quantity: item.quantity - 1 })} className="p-1 border rounded" aria-label="Decrease quantity">
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="text-sm w-6 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity.mutate({ id: item.id, quantity: item.quantity + 1 })} className="p-1 border rounded" aria-label="Increase quantity">
                          <Plus className="h-3 w-3" />
                        </button>
                        <button onClick={() => updateQuantity.mutate({ id: item.id, quantity: 0 })} className="ml-auto p-1 text-destructive" aria-label="Remove item">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary */}
            <div className="border rounded-lg p-6 bg-card h-fit sticky top-32">
              <h3 className="font-heading font-bold mb-4">Order Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>₦{total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delivery</span>
                  <span>{total >= 50000 ? "Free" : "₦2,500"}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span className="text-primary">₦{(total + (total >= 50000 ? 0 : 2500)).toLocaleString()}</span>
                </div>
              </div>
              <Button onClick={() => navigate("/checkout")} className="w-full mt-4">
                Proceed to Checkout
              </Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default CartPage;
