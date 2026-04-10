import "./globals.css";
import type { Metadata } from "next";
import { DM_Sans, Inter } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
});

const manrope = DM_Sans({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap"
});

export const metadata: Metadata = {
  metadataBase: new URL("https://servicebutler.ai"),
  title: {
    default: "Service Butler | Opportunity Intelligence for Restoration Teams",
    template: "%s | Service Butler"
  },
  description: "AI-powered opportunity intelligence for restoration and home service companies, from live signal detection to routed leads and booked jobs.",
  keywords: [
    "home service software",
    "contractor CRM",
    "lead management",
    "job scheduling software",
    "dispatch software",
    "AI for contractors"
  ],
  authors: [{ name: "Service Butler" }],
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "Service Butler | Opportunity Intelligence for Restoration Teams",
    description: "Find restoration opportunities sooner, route them faster, and convert more of them into booked work.",
    url: "/",
    siteName: "Service Butler",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/brand/servicebutler_logo.svg",
        width: 1200,
        height: 916,
        alt: "Service Butler"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Service Butler | Opportunity Intelligence for Restoration Teams",
    description: "Find restoration opportunities sooner, route them faster, and convert more of them into booked work.",
    images: ["/brand/servicebutler_logo.svg"]
  },
  robots: {
    index: true,
    follow: true
  },
  icons: {
    icon: [{ url: "/brand/servicebutler_icon.svg", type: "image/svg+xml" }],
    shortcut: [{ url: "/brand/servicebutler_icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/brand/servicebutler_icon.svg", type: "image/svg+xml" }]
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable} scroll-smooth`}>
      <body className="min-h-screen bg-semantic-bg text-semantic-text antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
