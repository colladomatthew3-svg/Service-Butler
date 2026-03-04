import "./globals.css";
import type { Metadata } from "next";
import { ToastProvider } from "@/components/ui/toast";
import { inter, manrope } from "@/lib/brand/brand";

export const metadata: Metadata = {
  title: "ServiceButler.ai",
  description: "Lead intake, scheduling, and follow-up operations for home service teams.",
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
