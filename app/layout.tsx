import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StringLine",
  description: "A ranked league for tennis and pickleball players.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
