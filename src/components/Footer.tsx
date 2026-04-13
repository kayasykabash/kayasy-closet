import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="bg-foreground text-card mt-16">
      <div className="container py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <h3 className="font-heading text-xl font-bold text-gradient-gold mb-3">KAYASY</h3>
            <p className="text-sm opacity-70 leading-relaxed">All In One Collection — Your one-stop destination for premium fashion, fabrics, and lifestyle essentials.</p>
          </div>
          <div>
            <h4 className="font-heading font-semibold mb-3">Shop</h4>
            <div className="space-y-2 text-sm opacity-70">
              <Link to="/shop/fabrics" className="block hover:opacity-100">Fabrics</Link>
              <Link to="/shop/jerseys" className="block hover:opacity-100">Jerseys</Link>
              <Link to="/shop/trousers" className="block hover:opacity-100">Trousers</Link>
              <Link to="/shop/jeans" className="block hover:opacity-100">Jeans</Link>
              <Link to="/shop/shirts" className="block hover:opacity-100">Shirts</Link>
            </div>
          </div>
          <div>
            <h4 className="font-heading font-semibold mb-3">Support</h4>
            <div className="space-y-2 text-sm opacity-70">
              <p>Contact Us</p>
              <p>Shipping Policy</p>
              <p>Returns & Exchanges</p>
              <p>FAQs</p>
            </div>
          </div>
          <div>
            <h4 className="font-heading font-semibold mb-3">Connect</h4>
            <div className="space-y-2 text-sm opacity-70">
              <p>Instagram</p>
              <p>Twitter</p>
              <p>Facebook</p>
              <p>WhatsApp</p>
            </div>
          </div>
        </div>
        <div className="border-t border-card/10 mt-8 pt-6 text-center text-xs opacity-50">
          © {new Date().getFullYear()} KAYASY All In One Collection. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
