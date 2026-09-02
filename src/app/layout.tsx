import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Risikon",
  description: "Risiko online contro amici e IA, con economia Risikon",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
