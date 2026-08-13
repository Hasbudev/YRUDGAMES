import type { Metadata } from "next";
import { Cinzel, Inter } from "next/font/google";
import "./globals.css";
import { SceneMoodProvider } from "@/components/scene/SceneMoodContext";
import { ArenaBackdrop } from "@/components/scene/ArenaBackdrop";

const bodyFont = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

const displayFont = Cinzel({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "900"],
});

export const metadata: Metadata = {
  title: "YRUD GAMES",
  description: "Un battle royale de quiz animé en direct par Yrud — RPPLF League France.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${bodyFont.variable} ${displayFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SceneMoodProvider>
          <ArenaBackdrop />
          {children}
        </SceneMoodProvider>
      </body>
    </html>
  );
}
