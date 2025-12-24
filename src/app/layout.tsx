import type { Metadata, Viewport } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "NerdQuiz | Battle of Brains",
  description: "Das ultimative Multiplayer Quiz-Duell. Fordere deine Freunde heraus!",
  keywords: ["quiz", "multiplayer", "trivia", "game", "nerd", "battle"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0f1a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className={`${outfit.variable} ${jetbrainsMono.variable} font-sans`}>
        {/* Background */}
        <div className="fixed inset-0 -z-10 bg-background">
          <div className="absolute inset-0 bg-gradient-glow" />
          <div className="absolute inset-0 bg-grid opacity-30" />
        </div>
        
        {children}
      </body>
    </html>
  );
}
