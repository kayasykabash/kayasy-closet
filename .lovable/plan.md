# Multiple Designs / Variants per Product

Note: This project runs on React + Lovable Cloud (Postgres), not Node/Express/MongoDB. I'll implement the same feature using the existing stack — no rebuild, just extensions.

## 1. Database (migration)
Add a new table `product_variants`:
- `product_id` (FK → products, cascade delete)
- `design_name` (text, required)
- `color` (text)
- `images` (text[]) — gallery per design (front/back/side)
- `stock` (int, default 0)
- `extra_price` (numeric, default 0)
- `sort_order` (int)
- timestamps + update trigger

RLS:
- Public read (matches `products`)
- Admin-only insert/update/delete (via `has_role`)

Add a trigger to log variant stock changes into `stock_movements` (mirrors existing product behavior).

Keep the existing `products.designs text[]` column for backward compatibility — new UI prefers `product_variants` when present.

## 2. Admin — Add/Edit Product (`AdminProducts.tsx`)
Inside the product dialog, add a **"Product Variants / Designs"** section:
- List of variant rows with: Design name, Color, Extra price, Stock, multi-image upload (uses existing `product-images` bucket)
- `+ Add Another Design` button
- `Remove` button per row
- On submit: upsert variants in a single transaction-like flow (delete removed, insert new, update existing by id)
- Low-stock badge (⚠ orange) on any variant with `stock < 5`

## 3. Admin Dashboard low-stock widget
Extend the existing low-stock indicator to include variants (`product_variants.stock < 5`) alongside product-level stock.

## 4. Product Details Page (`Product.tsx`)
- Fetch variants with the product
- If variants exist:
  - Replace the legacy "Design" chip row with a **Design Selector** showing color swatch + design name thumbnails
  - Selecting a variant:
    - Swaps the main image to the variant's first image
    - Shows variant image gallery (thumbnails → click to enlarge)
    - Updates displayed price (`product.price + variant.extra_price`)
    - Updates stock label and Add-to-Cart disabled state
- Smooth fade transition on image switch
- Mobile-first: horizontal scroll for design chips, 2-col thumb grid on mobile

## 5. Cart (`useCart`, `cart_items` table)
- Add columns `variant_id uuid`, `variant_image text` (nullable, backward compatible)
- `addToCart` accepts `variantId`/`variantImage`; Cart UI shows design name + color + thumbnail
- Quantity guard uses variant stock when applicable

## 6. Orders (`order_items`)
- Add columns `variant_id`, `variant_design`, `variant_color`, `variant_image`
- Checkout copies these from cart → order items
- Order history & admin order detail display the selected design
- Stock decrement trigger updates `product_variants.stock` when `variant_id` is set, else falls back to `products.stock` (current behavior)

## 7. UI polish
- Color swatch component (uses CSS color name / hex when recognizable, otherwise neutral chip with label)
- Selected state ring using `--primary`
- Skeletons while variants load
- All styling via existing semantic tokens (no hard-coded colors)

## Out of scope
- Changing checkout payment flow
- Reworking the existing `sizes`/`colors`/`designs` text arrays beyond keeping them readable as a fallback

## Technical notes
- Files touched: `supabase/migrations/*` (new), `src/pages/admin/AdminProducts.tsx`, `src/pages/Product.tsx`, `src/hooks/useProducts.ts`, `src/hooks/useCart.ts`, `src/pages/Cart.tsx`, `src/pages/Checkout.tsx`, `src/pages/Orders.tsx`, admin order views, `src/components/ProductCard.tsx` (low-stock badge), dashboard low-stock widget.
- Types regenerate automatically after migration approval.

Approve and I'll ship it in order: migration → admin form → product page → cart → orders → polish.