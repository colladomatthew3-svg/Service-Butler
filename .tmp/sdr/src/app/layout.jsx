"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metadata = void 0;
exports.default = RootLayout;
require("./globals.css");
const toast_1 = require("@/components/ui/toast");
const brand_1 = require("@/lib/brand/brand");
exports.metadata = {
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
                url: "/brand/servicebutler_logo.svg",
                width: 1200,
                height: 916,
                alt: "Service Butler"
            }
        ]
    },
    twitter: {
        card: "summary_large_image",
        title: "Service Butler | AI Lead and Job Management for Contractors",
        description: "Lead intake, dispatch, scheduling, and follow-up software for premium home service teams.",
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
function RootLayout({ children }) {
    return (<html lang="en" className={`${brand_1.inter.variable} ${brand_1.manrope.variable}`}>
      <body>
        <toast_1.ToastProvider>{children}</toast_1.ToastProvider>
      </body>
    </html>);
}
