import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Libre_Baskerville } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ui/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: 'swap',
});

const libreBaskerville = Libre_Baskerville({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: 'swap',
});

export const metadata: Metadata = {
  title: "Prism Assessment Quiz",
  description: "Trace health symptoms to root causes through energy metabolism, gut health, and stress cascades",
  metadataBase: new URL("https://prism-questions.vercel.app"),
  openGraph: {
    title: "Prism Assessment Quiz",
    description: "Trace health symptoms to root causes through energy metabolism, gut health, and stress cascades",
    url: "https://prism-questions.vercel.app",
    siteName: "Prism Assessment Quiz",
    images: [
      {
        url: "/25.png",
        width: 1000,
        height: 1000,
        alt: "Prism Assessment Quiz",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Prism Assessment Quiz",
    description: "Trace health symptoms to root causes through energy metabolism, gut health, and stress cascades",
    images: ["/25.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${libreBaskerville.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
