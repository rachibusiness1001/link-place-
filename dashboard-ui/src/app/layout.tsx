import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import RouteGuard from "@/components/RouteGuard";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Link Place Dashboard",
  description: "Premium SaaS Dashboard for Link Place",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <RouteGuard>
          {children}
        </RouteGuard>
      </body>
    </html>
  );
}
