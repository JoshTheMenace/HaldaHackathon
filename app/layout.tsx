import type { Metadata } from "next";
import { Poppins, Inter } from "next/font/google";
import "./globals.css";
import { HaldaProvider } from "@/lib/useHalda";
import RewardToaster from "@/components/RewardToaster";

const display = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Halda — a college guide in your pocket",
  description:
    "An always-on AI guide that learns each student over time. SMS, email, and web. Built for students, not schools.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-screen antialiased">
        <HaldaProvider>
          {children}
          <RewardToaster />
        </HaldaProvider>
      </body>
    </html>
  );
}
