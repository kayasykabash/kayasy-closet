import { MessageCircle } from "lucide-react";

const WHATSAPP_URL =
  "https://wa.me/2349066413224?text=" +
  encodeURIComponent("Hello Kayasy, I need help with your platform");

export function WhatsAppButton() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with Emmanuel Kayasy on WhatsApp"
      className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,40%)] text-white rounded-full shadow-lg shadow-black/30 px-4 py-3 transition-transform hover:scale-105 active:scale-95"
    >
      <MessageCircle className="h-5 w-5" />
      <span className="hidden sm:inline text-sm font-semibold">Chat with us</span>
    </a>
  );
}
