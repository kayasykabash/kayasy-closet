import { Link, useNavigate } from "react-router-dom";
import { Search, ShoppingCart, Heart, User, Menu, X, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/hooks/useCart";
import { useCategories } from "@/hooks/useCategories";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Navbar() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { user, isAdmin, signOut } = useAuth();
  const { count } = useCart();
  const { data: categories } = useCategories();
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery("");
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      {/* Top bar */}
      <div className="bg-foreground text-card py-1.5 text-center text-xs tracking-wide font-body">
        Free delivery on orders over ₦50,000 | <Link to="/shop" className="underline">Shop Now</Link>
      </div>

      <div className="container flex items-center justify-between gap-4 py-3">
        {/* Mobile menu toggle */}
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden">
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>

        {/* Logo */}
        <Link to="/" className="flex-shrink-0">
          <h1 className="font-heading text-lg font-bold tracking-tight sm:text-xl">
            <span className="text-gradient-gold">KAYASY</span>
          </h1>
          <p className="text-[9px] tracking-[0.2em] text-muted-foreground uppercase -mt-1 hidden sm:block">All In One Collection</p>
        </Link>

        {/* Desktop search */}
        <form onSubmit={handleSearch} className="hidden lg:flex flex-1 max-w-xl">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-full border bg-secondary/50 py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </form>

        {/* Right icons */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={() => setSearchOpen(!searchOpen)} className="lg:hidden p-2">
            <Search className="h-5 w-5" />
          </button>

          {user && (
            <Link to="/wishlist" className="p-2 hidden sm:block">
              <Heart className="h-5 w-5" />
            </Link>
          )}

          <Link to="/cart" className="relative p-2">
            <ShoppingCart className="h-5 w-5" />
            {count > 0 && (
              <Badge className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px] bg-primary text-primary-foreground">
                {count}
              </Badge>
            )}
          </Link>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-2"><User className="h-5 w-5" /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate("/orders")}>My Orders</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/wishlist")}>Wishlist</DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/admin")}>Admin Dashboard</DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}>Sign Out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/auth">
              <Button variant="outline" size="sm" className="text-xs">Sign In</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Desktop nav */}
      <nav className="hidden lg:block border-t bg-secondary/30">
        <div className="container flex items-center gap-6 py-2 text-sm">
          <Link to="/shop" className="font-medium hover:text-primary transition-colors">All Products</Link>
          {categories?.map(cat => (
            <DropdownMenu key={cat.id}>
              <DropdownMenuTrigger className="flex items-center gap-1 hover:text-primary transition-colors">
                {cat.name} <ChevronDown className="h-3 w-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => navigate(`/shop/${cat.slug}`)}>
                  All {cat.name}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {cat.children?.map(sub => (
                  <DropdownMenuItem key={sub.id} onClick={() => navigate(`/shop/${sub.slug}`)}>
                    {sub.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ))}
        </div>
      </nav>

      {/* Mobile search */}
      {searchOpen && (
        <div className="lg:hidden border-t p-3">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="w-full rounded-full border bg-secondary/50 py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </form>
        </div>
      )}

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t bg-card animate-slide-in">
          <div className="container py-4 space-y-3">
            <Link to="/shop" onClick={() => setMobileMenuOpen(false)} className="block py-2 font-medium">All Products</Link>
            {categories?.map(cat => (
              <div key={cat.id}>
                <Link to={`/shop/${cat.slug}`} onClick={() => setMobileMenuOpen(false)} className="block py-2 font-medium">{cat.name}</Link>
                <div className="pl-4 space-y-1">
                  {cat.children?.map(sub => (
                    <Link key={sub.id} to={`/shop/${sub.slug}`} onClick={() => setMobileMenuOpen(false)} className="block py-1 text-sm text-muted-foreground">{sub.name}</Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
