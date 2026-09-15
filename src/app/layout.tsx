import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { MentalCaddie } from "@/components/caddie/mental-caddie";
import { AppHeader } from "@/components/layout/app-header";
import { PageTransition } from "@/components/layout/page-transition";
import { CaddieContextProvider } from "@/lib/caddie/caddie-context";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fore!Mind",
  description:
    "Your personal mental caddie that learns what gets in your head and helps you manage it.",
};

export const viewport: Viewport = {
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background pb-10 font-sans text-foreground">
        <CaddieContextProvider>
          <AppHeader />
          <PageTransition>{children}</PageTransition>
          <MentalCaddie />
        </CaddieContextProvider>
      </body>
    </html>
  );
}
