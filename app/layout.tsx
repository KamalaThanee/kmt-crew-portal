import "./globals.css";
import Navbar from "@/components/Navbar";
import CartDrawer from "@/components/CartDrawer";
import { Toaster } from 'sonner';
import { RealtimeListener } from "@/components/RealtimeListener";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased pb-20 pt-16 md:pt-20">
        <RealtimeListener />
        <Toaster position="top-center" expand={false} richColors theme="dark" />
        <Navbar />
        <CartDrawer />
        <main className="max-w-7xl mx-auto px-4">{children}</main>
      </body>
    </html>
  );
}
