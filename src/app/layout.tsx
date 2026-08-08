import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Agnus Dei — homeschool co-ops and curriculum in one place",
    template: "%s · Agnus Dei",
  },
  description:
    "Browse homeschool co-ops and curriculum for free, then let Bede teach from the books you already own.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
