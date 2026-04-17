import "./globals.css";
import Navbar from "@/components/Navbar";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const userRole = "Safety Officer"; // แก้เป็นดึงจาก DB ภายหลัง
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-zinc-100 antialiased">
        <Navbar userRole={userRole} />
        <main>{children}</main>
      </body>
    </html>
  );
}
