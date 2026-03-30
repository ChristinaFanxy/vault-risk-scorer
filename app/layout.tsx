import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Morpho Vault Risk Scorer",
  description: "Assess Morpho vault risk before you deposit",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-brand-bg text-brand-cream">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
