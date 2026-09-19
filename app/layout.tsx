import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trips Loom — Trip Planner",
  description: "Plan your days, shape your wardrobe, and pack with confidence.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
