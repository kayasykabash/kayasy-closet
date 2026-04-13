import { useParams, useSearchParams, Link } from "react-router-dom";
import { useState } from "react";
import { Layout } from "@/components/Layout";
import { ProductCard } from "@/components/ProductCard";
import { useProducts } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const ShopPage = () => {
  const { category } = useParams();
  const [searchParams] = useSearchParams();
  const search = searchParams.get("search") || "";
  const [sortBy, setSortBy] = useState("newest");
  const { data: products, isLoading } = useProducts({ categorySlug: category, search, sortBy });
  const { data: categories } = useCategories();

  return (
    <Layout>
      <div className="container py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <span>/</span>
          <span className="text-foreground font-medium">{category ? category.replace(/-/g, " ") : search ? `"${search}"` : "All Products"}</span>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <aside className="lg:w-56 flex-shrink-0">
            <h3 className="font-heading font-bold mb-3 text-sm">Categories</h3>
            <div className="space-y-1">
              <Link to="/shop" className={`block text-sm py-1.5 px-2 rounded transition-colors ${!category ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"}`}>
                All Products
              </Link>
              {categories?.map(cat => (
                <div key={cat.id}>
                  <Link to={`/shop/${cat.slug}`} className={`block text-sm py-1.5 px-2 rounded transition-colors ${category === cat.slug ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"}`}>
                    {cat.name}
                  </Link>
                  {cat.children?.map(sub => (
                    <Link key={sub.id} to={`/shop/${sub.slug}`} className={`block text-xs py-1 px-4 rounded transition-colors ${category === sub.slug ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}>
                      {sub.name}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          </aside>

          {/* Products grid */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">{products?.length || 0} products</p>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-40 text-xs h-8">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="price-asc">Price: Low to High</SelectItem>
                  <SelectItem value="price-desc">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="aspect-[3/4] rounded-lg" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
              </div>
            ) : products?.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <p>No products found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {products?.map(p => <ProductCard key={p.id} product={p as any} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ShopPage;
