import type { Metadata } from "next";
import ScreenSwitcher from "@/components/ScreenSwitcher";
import "./globals.css";

export const metadata: Metadata = {
  title: "Publieke Peiler Quiz",
  description: "Luchtige quiz op basis van een Public Insights Dashboard Bundle.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <body>
        {children}
        <ScreenSwitcher />
      </body>
    </html>
  );
}
