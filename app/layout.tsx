import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BrainLex ERP",
  description: "ERP Legal & Fiscal — Lexconomy / Lawork",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} antialiased`}>
        <div className="flex h-screen overflow-hidden bg-zinc-950">
          {/* Sidebar fijo izquierda */}
          <Sidebar />

          {/* Columna derecha: Topbar + contenido scrollable */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <Topbar />
            <main className="flex-1 overflow-y-auto bg-zinc-950 p-6">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
