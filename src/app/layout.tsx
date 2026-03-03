import "./globals.css";
import type { Metadata } from "next";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "ServiceButler.ai",
  description: "Lead intake, scheduling, and follow-up operations for home service teams.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/brand/logo-mark.svg", type: "image/svg+xml" }
    ],
    apple: [{ url: "/brand/logo-mark.svg", type: "image/svg+xml" }]
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
