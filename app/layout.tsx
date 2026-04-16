import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "KMT Crew Portal",
  description: "PPE & Inventory Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-zinc-950 text-white min-h-screen`}>
        <Navbar />
        {/* เว้นที่ว่างด้านบนไว้ให้ Navbar ที่ Fix ไว้ */}
        <main className="pt-16">
          {children}
        </main>
      </body>
    </html>
  );
}
