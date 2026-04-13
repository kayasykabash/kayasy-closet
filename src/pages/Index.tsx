import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { ProductCard } from "@/components/ProductCard";
import { useProducts } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { ArrowRight, Truck, Shield, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

const HomePage = () => {
  const { data: featuredProducts } = useProducts({ featured: true, limit: 8 });
  const { data: categories } = useCategories();

  return (
    <Layout>
      {/* Hero Banner */}
      <section className="relative bg-foreground text-card overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-foreground via-foreground/90 to-transparent z-10" />
        <div className="container relative z-20 py-16 sm:py-24 lg:py-32">
          <div className="max-w-lg">
            <p className="text-xs tracking-[0.3em] uppercase text-gold mb-3 font-medium">New Collection 2026</p>
            <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-4">
              <span className="text-gradient-gold">KAYASY</span>
              <br />
              <span className="text-card">All In One Collection</span>
            </h1>
            <p className="text-sm sm:text-base opacity-70 mb-6 leading-relaxed">
              Discover premium fabrics, trendy jerseys, and stylish fashion pieces. Your one-stop destination for quality fashion.
            </p>
            <div className="flex gap-3">
              <Link to="/shop">
                <Button className="bg-primary text-primary-foreground hover:bg-gold-dark font-semibold px-6">
                  Shop Now <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/shop/fabrics">
                <Button variant="outline" className="border-card/30 text-card hover:bg-card/10">
                  Explore Fabrics
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Perks */}
      <section className="border-b">
        <div className="container py-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: Truck, text: "Free Delivery Over ₦50,000" },
            { icon: Shield, text: "Secure Payment" },
            { icon: RotateCcw, text: "Easy Returns" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Icon className="h-4 w-4 text-primary" />
              <span>{text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="container py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading text-xl sm:text-2xl font-bold">Shop by Category</h2>
          <Link to="/shop" className="text-sm text-primary hover:underline flex items-center gap-1">
            View All <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {categories?.map(cat => (
            <Link
              key={cat.id}
              to={`/shop/${cat.slug}`}
              className="group relative aspect-[4/5] rounded-lg overflow-hidden bg-muted border hover:shadow-lg transition-all"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent z-10" />
              <div className="absolute bottom-0 left-0 right-0 p-3 z-20">
                <h3 className="font-heading font-bold text-card text-sm">{cat.name}</h3>
                <p className="text-[10px] text-card/70">{cat.children?.length || 0} subcategories</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Products */}
      <section className="container py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading text-xl sm:text-2xl font-bold">Trending Now</h2>
          <Link to="/shop" className="text-sm text-primary hover:underline flex items-center gap-1">
            See All <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {featuredProducts?.map(product => (
            <ProductCard key={product.id} product={product as any} />
          ))}
        </div>
      </section>

      {/* CTA Banner */}
      <section className="bg-foreground text-card">
        <div className="container py-16 text-center">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold mb-3">
            Join the <span className="text-gradient-gold">KAYASY</span> Family
          </h2>
          <p className="text-sm opacity-70 mb-6 max-w-md mx-auto">
            Sign up for exclusive deals, new arrivals, and style inspiration.
          </p>
          <Link to="/auth">
            <Button className="bg-primary text-primary-foreground hover:bg-gold-dark px-8">Create Account</Button>
          </Link>
        </div>
      </section>
    </Layout>
  );
};

export default HomePage;
