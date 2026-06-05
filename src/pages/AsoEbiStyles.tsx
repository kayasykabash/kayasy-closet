import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Sparkles, Crown, Heart, ShoppingBag } from "lucide-react";

const styles = [
  {
    name: "Classic Cord Lace Gown",
    description:
      "Floor-sweeping cord lace in champagne or burgundy — the timeless choice for mothers of the bride and senior aunties. Pair with a coral bead set and a gele in autograph fabric.",
    bestFor: "Traditional weddings, engagements",
  },
  {
    name: "French Lace Kaftan",
    description:
      "Soft French lace, sequined or plain, cut as a flowy kaftan with cape sleeves. Light, breathable, and unmistakably elegant — a favourite for Owambe in Lagos and Abuja.",
    bestFor: "Wedding receptions, anniversaries",
  },
  {
    name: "Off-Shoulder Sequin Mermaid",
    description:
      "Sequin lace tailored mermaid style with an off-shoulder neckline. Striking on bridesmaids and bridal squads who want a coordinated red-carpet entrance.",
    bestFor: "Bridesmaids, bridal trains",
  },
  {
    name: "Two-Piece Skirt & Blouse",
    description:
      "A peplum lace blouse with a wrap or trumpet skirt — easy to restyle after the wedding. Mix textures: guipure on top, satin lining underneath.",
    bestFor: "Owambe, family Aso Ebi groups",
  },
  {
    name: "Iro & Buba in Heavy Lace",
    description:
      "The richest take on tradition: wrapper (iro), buba blouse, ipele (shoulder sash), and a tall gele. Heavy guipure or 3D lace photographs beautifully.",
    bestFor: "Yoruba traditional weddings, introductions",
  },
  {
    name: "Modern Jumpsuit in Net Lace",
    description:
      "For the bold guest — a wide-leg jumpsuit cut from net lace with a cinched waist. Comfortable, photogenic, and perfect when you want to break from the crowd.",
    bestFor: "Younger guests, evening receptions",
  },
];

const fabricGuide = [
  { label: "Cord Lace", note: "Structured, beaded, holds shape — great for gowns and skirts." },
  { label: "French Lace", note: "Lightweight, sequined or plain — drapes softly." },
  { label: "Guipure Lace", note: "Heavy, raised motifs — luxurious for iro & buba sets." },
  { label: "Net Lace", note: "Sheer base with embroidery — modern silhouettes." },
  { label: "3D Lace", note: "Floral appliqués that pop — statement bridal looks." },
];

export default function AsoEbiStyles() {
  useEffect(() => {
    const prevTitle = document.title;
    const prevDesc = document.querySelector('meta[name="description"]')?.getAttribute("content");

    document.title =
      "Latest Aso Ebi Lace Styles for Weddings (2026 Guide) | KAYASY";
    const setMeta = (name: string, content: string) => {
      let tag = document.querySelector(`meta[name="${name}"]`);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("name", name);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
    };
    setMeta(
      "description",
      "Discover the latest Aso Ebi lace styles for Nigerian weddings — cord, French, guipure, and 3D lace lookbook with styling tips and fabric guide from KAYASY."
    );

    // JSON-LD Article schema
    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "Latest Aso Ebi Lace Styles for Weddings",
      description:
        "A guide to the most-loved Aso Ebi lace styles for Nigerian weddings, with fabric tips and styling ideas.",
      author: { "@type": "Organization", name: "KAYASY All In One Collection" },
      publisher: { "@type": "Organization", name: "KAYASY All In One Collection" },
      datePublished: "2026-06-05",
      image: "https://kayasy-closet.lovable.app/placeholder.svg",
      mainEntityOfPage: "https://kayasy-closet.lovable.app/blog/aso-ebi-styles",
    });
    document.head.appendChild(ld);

    return () => {
      if (prevTitle) document.title = prevTitle;
      if (prevDesc) {
        document.querySelector('meta[name="description"]')?.setAttribute("content", prevDesc);
      }
      document.head.removeChild(ld);
    };
  }, []);

  return (
    <Layout>
      {/* Hero */}
      <section className="bg-gradient-to-b from-secondary/30 to-background border-b">
        <div className="container mx-auto px-4 py-16 md:py-24 max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6">
            <Sparkles className="h-3.5 w-3.5" />
            Style Guide · Weddings 2026
          </div>
          <h1 className="font-heading text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Latest Aso Ebi Lace Styles for Nigerian Weddings
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            A KAYASY lookbook of the most-loved Aso Ebi lace styles — from heavy cord and
            guipure to airy French lace — with fabric tips so your group looks unforgettable.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button asChild size="lg">
              <Link to="/shop">
                <ShoppingBag className="h-4 w-4 mr-2" />
                Shop Lace Fabrics
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/shop/fabrics">Browse Wedding Collection</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Intro */}
      <section className="container mx-auto px-4 py-12 max-w-3xl">
        <p className="text-base md:text-lg leading-relaxed text-foreground/90">
          Aso Ebi — literally "family cloth" — is the heartbeat of every Nigerian celebration.
          When the bride picks her colours and her fabric, the rest of the family follows, and
          the result is a sea of coordinated lace that makes every Owambe unforgettable. Below
          are the styles, fabrics, and silhouettes leading 2026 weddings, plus tips on choosing
          a look that flatters every body type in your group.
        </p>
      </section>

      {/* Styles grid */}
      <section className="container mx-auto px-4 pb-12 max-w-6xl">
        <h2 className="font-heading text-2xl md:text-3xl font-bold mb-8 flex items-center gap-3">
          <Crown className="h-6 w-6 text-primary" />
          Six Trending Aso Ebi Looks
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {styles.map((s) => (
            <article
              key={s.name}
              className="bg-card border rounded-xl p-6 hover:shadow-lg transition-shadow"
            >
              <h3 className="font-heading text-lg font-semibold mb-2">{s.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{s.description}</p>
              <p className="text-xs uppercase tracking-wider text-primary font-medium">
                Best for: <span className="text-foreground/80 normal-case">{s.bestFor}</span>
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Fabric guide */}
      <section className="bg-secondary/20 border-y">
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <h2 className="font-heading text-2xl md:text-3xl font-bold mb-6">
            Choosing the Right Lace
          </h2>
          <p className="text-muted-foreground mb-8">
            Not all lace is created equal. Use this quick guide to match the fabric to the
            silhouette your group wants.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {fabricGuide.map((f) => (
              <div key={f.label} className="bg-card border rounded-lg p-4">
                <p className="font-heading font-semibold mb-1">{f.label}</p>
                <p className="text-sm text-muted-foreground">{f.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Styling tips */}
      <section className="container mx-auto px-4 py-12 max-w-3xl">
        <h2 className="font-heading text-2xl md:text-3xl font-bold mb-6">
          Styling Your Aso Ebi Group
        </h2>
        <ul className="space-y-4 text-base text-foreground/90">
          <li className="flex gap-3">
            <Heart className="h-5 w-5 text-primary shrink-0 mt-1" />
            <span>
              <strong>Pick one fabric, two silhouettes.</strong> Let older guests take iro &
              buba and younger ones do gowns or jumpsuits — same lace, more flattering fits.
            </span>
          </li>
          <li className="flex gap-3">
            <Heart className="h-5 w-5 text-primary shrink-0 mt-1" />
            <span>
              <strong>Coordinate gele and ipele colours,</strong> not the exact pattern. A
              contrasting autograph or sego gele lifts the whole look in photographs.
            </span>
          </li>
          <li className="flex gap-3">
            <Heart className="h-5 w-5 text-primary shrink-0 mt-1" />
            <span>
              <strong>Order extra yards.</strong> Heavy lace shrinks 5–10cm after the first
              wash — always buy a full extra yard per outfit to be safe.
            </span>
          </li>
          <li className="flex gap-3">
            <Heart className="h-5 w-5 text-primary shrink-0 mt-1" />
            <span>
              <strong>Book your tailor 6 weeks out.</strong> The best hands in Lagos, Ibadan,
              and Abuja close their books fast in wedding season.
            </span>
          </li>
        </ul>
      </section>

      {/* CTA */}
      <section className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-14 max-w-4xl text-center">
          <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
            Ready to dress your Aso Ebi group?
          </h2>
          <p className="opacity-90 mb-8 max-w-2xl mx-auto">
            KAYASY stocks premium cord, French, guipure, and 3D lace in the colours trending
            this season. Bulk orders welcome — talk to us for wedding pricing.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button asChild size="lg" variant="secondary">
              <Link to="/shop">Shop Lace Fabrics</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="bg-transparent border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground hover:text-primary"
            >
              <Link to="/dashboard">Contact KAYASY</Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
