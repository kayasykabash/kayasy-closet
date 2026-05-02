import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface InvoiceOrder {
  id: string;
  created_at: string;
  total: number;
  delivery_fee?: number;
  delivery_address?: string;
  delivery_city?: string;
  delivery_state?: string;
  delivery_phone?: string;
  payment_method?: string;
  payment_status?: string;
  status?: string;
}

interface InvoiceItem {
  product_name: string;
  quantity: number;
  price: number;
  size?: string | null;
  color?: string | null;
  design?: string | null;
}

interface InvoiceCustomer {
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
}

export function generateInvoicePDF(order: InvoiceOrder, items: InvoiceItem[], customer: InvoiceCustomer) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(13, 13, 13);
  doc.rect(0, 0, pageWidth, 35, "F");
  doc.setTextColor(201, 168, 76);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("KAYASY", 14, 18);
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("ALL IN ONE COLLECTION", 14, 24);
  doc.setFontSize(7);
  doc.text("Premium Fashion • Made in Nigeria", 14, 30);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text("INVOICE", pageWidth - 14, 18, { align: "right" });
  doc.setFontSize(9);
  doc.text(`#${order.id.slice(0, 8).toUpperCase()}`, pageWidth - 14, 25, { align: "right" });
  doc.text(new Date(order.created_at).toLocaleDateString(), pageWidth - 14, 30, { align: "right" });

  // Customer/billing
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("BILL TO", 14, 50);
  doc.setFont("helvetica", "normal");
  doc.text(customer.full_name || "Customer", 14, 56);
  if (customer.phone) doc.text(customer.phone, 14, 61);
  if (customer.email) doc.text(customer.email, 14, 66);

  doc.setFont("helvetica", "bold");
  doc.text("DELIVERY", pageWidth / 2, 50);
  doc.setFont("helvetica", "normal");
  const addrLines = [
    order.delivery_address,
    [order.delivery_city, order.delivery_state].filter(Boolean).join(", "),
    order.delivery_phone,
  ].filter(Boolean) as string[];
  addrLines.forEach((line, i) => doc.text(line, pageWidth / 2, 56 + i * 5));

  // Items table
  const rows = items.map(it => {
    const variant = [it.size, it.color, it.design].filter(Boolean).join(" / ");
    const name = variant ? `${it.product_name}\n(${variant})` : it.product_name;
    return [
      name,
      String(it.quantity),
      `NGN ${Number(it.price).toLocaleString()}`,
      `NGN ${(Number(it.price) * it.quantity).toLocaleString()}`,
    ];
  });

  autoTable(doc, {
    startY: 85,
    head: [["Item", "Qty", "Price", "Total"]],
    body: rows,
    headStyles: { fillColor: [13, 13, 13], textColor: [201, 168, 76], fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 1: { halign: "center" }, 2: { halign: "right" }, 3: { halign: "right" } },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;
  const subtotal = items.reduce((s, it) => s + Number(it.price) * it.quantity, 0);
  const fee = Number(order.delivery_fee || 0);

  doc.setFontSize(9);
  doc.text("Subtotal:", pageWidth - 60, finalY);
  doc.text(`NGN ${subtotal.toLocaleString()}`, pageWidth - 14, finalY, { align: "right" });
  doc.text("Delivery:", pageWidth - 60, finalY + 6);
  doc.text(`NGN ${fee.toLocaleString()}`, pageWidth - 14, finalY + 6, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TOTAL:", pageWidth - 60, finalY + 14);
  doc.setTextColor(201, 168, 76);
  doc.text(`NGN ${Number(order.total).toLocaleString()}`, pageWidth - 14, finalY + 14, { align: "right" });

  // Payment info
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Payment Method: ${(order.payment_method || "—").replace("_", " ").toUpperCase()}`, 14, finalY + 14);
  doc.text(`Payment Status: ${(order.payment_status || "—").toUpperCase()}`, 14, finalY + 19);
  doc.text(`Order Status: ${(order.status || "—").toUpperCase()}`, 14, finalY + 24);

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("Thank you for shopping with KAYASY ALL IN ONE COLLECTION", pageWidth / 2, pageHeight - 15, { align: "center" });
  doc.text("Support: +234 906 6413 224", pageWidth / 2, pageHeight - 10, { align: "center" });

  doc.save(`invoice-${order.id.slice(0, 8)}.pdf`);
}
