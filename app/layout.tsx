import "./globals.css";
import Navbar from "@/components/Navbar";
import CartDrawer from "@/components/CartDrawer";
import { RealtimeListener } from "@/components/RealtimeListener";
import OneSignalBridge from "@/components/OneSignalBridge";
import ThemeBridge from "@/components/ThemeBridge";
import ThemeToaster from "@/components/ThemeToaster";

const themeInitScript = `
  (function () {
    try {
      var storedTheme = window.localStorage.getItem('kmt_theme');
      var theme = storedTheme === 'dark' ? 'dark' : 'light';
      document.documentElement.classList.toggle('dark', theme === 'dark');
      document.documentElement.dataset.theme = theme;
    } catch (error) {}
  })();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-[var(--app-bg)] text-[var(--app-text)] antialiased pb-20 pt-4 md:pt-20 transition-colors duration-300">
        <ThemeBridge />
        <OneSignalBridge />
        <RealtimeListener />
        <ThemeToaster />
        <Navbar />
        <CartDrawer />
        <main className="w-full">{children}</main>
      </body>
    </html>
  );
}
