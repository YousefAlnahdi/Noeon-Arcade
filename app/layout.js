import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";
import Script from "next/script";

export const metadata = {
  title: "Neon Arcade — AI Retro Gaming Platform",
  description:
    "Experience classic gaming supercharged by AI. Play Tic-Tac-Toe and Snake with intelligent AI opponents, strategy coaches, and post-game analytics.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark h-full antialiased" suppressHydrationWarning>
      <head>
        <Script id="theme-initializer" strategy="beforeInteractive">
          {`
            try {
              const theme = localStorage.getItem('neon_arcade_theme') || 'cyberpunk';
              document.documentElement.setAttribute('data-theme', theme);
            } catch (e) {}
          `}
        </Script>
      </head>
      <body className="min-h-full flex flex-col grid-bg radial-mesh relative bg-surface text-on-surface">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
