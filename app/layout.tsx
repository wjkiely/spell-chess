import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Spell Chess",
  description: "Chess with Jump and Freeze spells – play online in real-time",
  icons: {
    icon: [
      { url: "/assets/favicons/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/assets/favicons/favicon.svg", type: "image/svg+xml" },
      { url: "/assets/favicons/favicon.ico" },
    ],
    apple: "/assets/favicons/apple-touch-icon.png",
  },
  manifest: "/assets/favicons/site.webmanifest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`min-h-screen ${inter.className}`} suppressHydrationWarning>
        {/* Runs synchronously before first paint – eliminates dark/light flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var theme = localStorage.getItem('spellChessTheme') || 'dark';
            var scheme = localStorage.getItem('spellChessBoardScheme') || (theme === 'light' ? 'wood' : 'green');
            document.body.dataset.theme = theme;
            document.body.dataset.scheme = scheme;
          })();
        `}} />
        {children}
      </body>
    </html>
  );
}
