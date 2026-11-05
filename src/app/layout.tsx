import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Ada — Follow your curiosity",
  description:
    "A thoughtful learning companion. Turn any curiosity into a course of your own.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
