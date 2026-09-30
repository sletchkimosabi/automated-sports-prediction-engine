import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Verdict / Kimo's Predict",
  description: "Moteur de pronostics sportifs quotidien automatisé (Next.js + Drizzle + PostgreSQL).",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-slate-100 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
