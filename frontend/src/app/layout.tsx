import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import { MotionConfig } from "framer-motion";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/auth-context";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "DisasterSense · Operations Console",
    template: "%s · DisasterSense",
  },
  description:
    "Live flood and landslide risk intelligence for Kerala: telemetry, ML inference, incident alerts, resource dispatch and analytics.",
  applicationName: "DisasterSense",
  keywords: ["disaster", "flood", "landslide", "Kerala", "risk", "operations"],
};

export const viewport: Viewport = {
  themeColor: "#070912",
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`dark ${outfit.variable}`} suppressHydrationWarning>
      <body className={`${outfit.className} min-h-screen bg-background font-sans text-foreground antialiased`}>
        <MotionConfig reducedMotion="user">
          <AuthProvider>{children}</AuthProvider>
        </MotionConfig>
      </body>
    </html>
  );
}
