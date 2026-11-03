import type { Metadata } from "next";
import { Bricolage_Grotesque, DM_Sans } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display" });
const body = DM_Sans({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Lucky Paddle — Book a court",
  description: "Four-leaf luck on every court. Pick a time, pay with GCash, Maya or card, and get your confirmation by email.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <div className="bg-scene" aria-hidden />
        <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[26rem] bg-gradient-to-b from-blue-100/35 via-yellow-50/25 to-transparent"></div>
        <div className="pointer-events-none fixed -left-36 top-32 -z-10 h-72 w-72 rounded-full bg-blue-300/16 blur-3xl"></div>
        <div className="pointer-events-none fixed -right-40 top-20 -z-10 h-88 w-88 rounded-full bg-red-300/14 blur-3xl"></div>
        <div className="pointer-events-none fixed left-1/3 bottom-[-16rem] -z-10 h-[24rem] w-[24rem] rounded-full bg-yellow-200/20 blur-3xl"></div>
        {children}
      </body>
    </html>
  );
}
