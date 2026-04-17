import "./globals.css";
import Navbar from "@/components/Navbar";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      {/* ใส่ padding bottom 20 เผื่อเว้นที่ให้ Bottom Nav บนมือถือ ไม่ให้บัง Content */}
      {/* ใส่ padding top 16 ให้ Mobile Top bar ด้วย */}
      <body className="bg-slate-950 text-slate-100 antialiased pb-20 pt-14 md:pt-16 md:pb-0">
        <Navbar />
        <main className="max-w-7xl mx-auto">{children}</main>
      </body>
    </html>
  );
}
