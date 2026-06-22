import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VerdictArena — verifiable AI judge on 0G",
  description:
    "A public arena where an AI judge settles duels on TEE-verifiable 0G Compute. Every verdict ships with a proof you can check yourself.",
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
