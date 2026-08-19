import type { Metadata } from "next";
import localFont from "next/font/local";

import { QueryProvider } from "@/components/providers/query-provider";
import "./globals.css";

const departureMono = localFont({
  src: "../public/fonts/departure-mono/DepartureMono-1.500/DepartureMono-Regular.woff2",
  variable: "--font-departure-mono",
  display: "swap",
  fallback: ["ui-monospace", "monospace"],
});

export const metadata: Metadata = {
  title: "Zomboid Save Manager",
  description: "Gerenciamento local e seguro de saves do Project Zomboid.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={departureMono.variable}>
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
