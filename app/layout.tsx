import type { ReactNode } from "react";

export const metadata = {
  title: "Token Ekspertiz",
  description: "Solana token'ları için yapay zekâ destekli risk analizi",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
