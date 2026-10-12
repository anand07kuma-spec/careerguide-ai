import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/lib/session";
import { ToastProvider } from "@/components/ui/toast";

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
    default: "CareerGuide AI — Explore careers, one conversation at a time",
    template: "%s · CareerGuide AI",
  },
  description:
    "A friendly voice and chat guide that helps Indian students from class 3 to 12 explore careers, build study plans and involve their parents. Conversations can be in Hindi, English or Hinglish.",
  keywords: [
    "career guidance for students",
    "career explorer India",
    "Hindi career guidance",
    "parent career dashboard",
    "study plan",
  ],
  authors: [{ name: "CareerGuide AI" }],
  openGraph: {
    title: "CareerGuide AI",
    description:
      "Explore careers through friendly conversation. Not an aptitude test, and it does not predict a future.",
    type: "website",
    locale: "en_IN",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0b1730",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      data-reduced-motion="false"
      data-high-contrast="false"
    >
      <body className="flex min-h-full flex-col">
        <ToastProvider>
          <SessionProvider>{children}</SessionProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
