import type { Metadata, Viewport } from "next";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { ToastViewport } from "@/components/ui/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "마포 청우회 리그",
  description: "마포 청우회 테니스 클럽 매치 레이팅",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0B1929",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="font-body">
        <div className="mx-auto min-h-screen max-w-md pb-20">{children}</div>
        <BottomTabBar />
        <ToastViewport />
      </body>
    </html>
  );
}
