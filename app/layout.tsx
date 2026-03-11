import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import { ClientProviders } from "@/components/layout/ClientProviders";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BrainLex ERP",
  description: "ERP Legal & Fiscal — Gestión multitenant",
};

// Script anti-FOUC: aplica class="light" en <html> ANTES del primer paint.
const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='light')document.documentElement.classList.add('light');}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${geistSans.variable} antialiased`}>
        <ClientProviders>
          <div className="flex h-screen overflow-hidden bg-surface-page">
            {/* Sidebar fijo izquierda */}
            <Sidebar />

            {/* Columna derecha: Topbar + contenido scrollable */}
            <div className="flex flex-1 flex-col overflow-hidden">
              <Topbar />
              <main className="flex-1 overflow-y-auto bg-surface-page p-6">
                {children}
              </main>
            </div>
          </div>
        </ClientProviders>
      </body>
    </html>
  );
}
