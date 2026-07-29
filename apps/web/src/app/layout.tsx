import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { PortalShell } from "@/components/layout/PortalShell";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Property Portal — Estimator & Analytics",
    template: "%s | Property Portal",
  },
  description:
    "Unified Next.js portal hosting a FastAPI-backed Property Value Estimator and a Spring Boot-backed Property Market Analysis dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <PortalShell>{children}</PortalShell>
      </body>
    </html>
  );
}
