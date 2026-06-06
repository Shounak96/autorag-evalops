import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "AutoRAG EvalOps",
  description:
    "Advanced agentic RAG evaluation, monitoring, and deployment platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}