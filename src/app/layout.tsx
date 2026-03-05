import "./globals.css";
import type { Metadata } from "next";
import { ToastProvider } from "@/components/ui/toast";
import { inter, manrope } from "@/lib/brand/brand";

export const metadata: Metadata = {
  metadataBase: new URL("https://servicebutler.ai"),
  title: {
    default: "Service Butler | AI Lead and Job Management for Contractors",
    template: "%s | Service Butler"
  },
  description: "Premium AI lead intake, dispatch, scheduling, and follow-up software for home service businesses.",
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
    title: "Service Butler | AI Lead and Job Management for Contractors",
    description: "Run a tighter home service business with faster lead response, cleaner scheduling, and polished customer follow-up.",
    url: "/",
    siteName: "Service Butler",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/brand/logo.png",
        width: 1200,
        height: 630,
        alt: "Service Butler"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Service Butler | AI Lead and Job Management for Contractors",
    description: "Lead intake, dispatch, scheduling, and follow-up software for premium home service teams.",
    images: ["/brand/logo.png"]
  },
  robots: {
    index: true,
    follow: true
  },
  icons: {
    icon: [{ url: "/favicon.ico" }, { url: "/brand/logo-mark.png", type: "image/png" }],
    apple: [{ url: "/brand/logo-mark.png", type: "image/png" }]
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable}`}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
