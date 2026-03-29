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
    default: "Service Butler | Operator Command Center",
    template: "%s | Service Butler"
  },
  description: "Premium operator command center for home service businesses, built for lead intake, dispatch, scheduling, and booked-job proof.",
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
    title: "Service Butler | Operator Command Center",
    description: "Run a tighter home service business with faster lead response, cleaner scheduling, and booked-job proof.",
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
    title: "Service Butler | Operator Command Center",
    description: "Lead intake, dispatch, scheduling, and booked-job proof for premium home service teams.",
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
