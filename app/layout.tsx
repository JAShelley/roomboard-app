import type { Metadata } from "next";
import "./globals.css";
import { PostHogProvider } from "./providers";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata: Metadata = {
  title: "RoomBoard",
  description: "Modular RoomBoard application shell",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <PostHogProvider>{children}</PostHogProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
