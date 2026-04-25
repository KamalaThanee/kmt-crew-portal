import "./globals.css";
import Navbar from "@/components/Navbar";
import CartDrawer from "@/components/CartDrawer";
import { Toaster } from 'sonner';
import { RealtimeListener } from "@/components/RealtimeListener";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body className="app-shell antialiased pb-20 pt-16 md:pt-20">
        <RealtimeListener />
        <Toaster closeButton position="top-center" expand={false} richColors theme="dark" />
        <Navbar />
        <CartDrawer />
        <main className="app-main max-w-7xl mx-auto px-4">{children}</main>
      </body>
    </html>
  );
}
