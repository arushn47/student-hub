import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "nprogress/nprogress.css";
import "katex/dist/katex.min.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { Suspense } from "react";
import { NavigationProgress } from "@/components/navigation-progress";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

function getMetadataBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (explicit) {
    return explicit.startsWith("http://") || explicit.startsWith("https://")
      ? explicit
      : `https://${explicit}`;
  }

  // Vercel provides the hostname without protocol.
  const vercel = process.env.VERCEL_URL;
  if (vercel) {
    return `https://${vercel}`;
  }

  return "http://localhost:3000";
}

export const metadata: Metadata = {
  metadataBase: new URL(getMetadataBaseUrl()),
  title: {
    default: "StudentHub - AI-Powered Study Companion",
    template: "%s | StudentHub",
  },
  description: "Your ultimate AI-powered study companion. Notes, tasks, exam prep, CGPA calculator, and focus tools — everything you need to ace your studies in one beautiful app.",
  keywords: [
    "student productivity",
    "study app",
    "notes app",
    "task management",
    "exam preparation",
    "CGPA calculator",
    "pomodoro timer",
    "AI study assistant",
    "flashcards",
    "student planner",
  ],
  authors: [{ name: "Arush Nandakumar Menon" }],
  creator: "Arush Nandakumar Menon",
  publisher: "StudentHub",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "StudentHub",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "StudentHub",
    title: "StudentHub - AI-Powered Study Companion",
    description: "Your ultimate AI-powered study companion. Notes, tasks, exam prep, and focus tools — everything you need to ace your studies.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "StudentHub - AI-Powered Study Companion",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "StudentHub - AI-Powered Study Companion",
    description: "Your ultimate AI-powered study companion. Notes, tasks, exam prep, and focus tools — everything you need to ace your studies.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#a855f7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <ServiceWorkerRegistration />
          <Suspense fallback={null}>
            <NavigationProgress />
          </Suspense>
          {children}
          <Toaster position="top-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
