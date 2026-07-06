import type { Metadata, Viewport } from "next";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { MemberAuthBar } from "@/components/layout/MemberAuthBar";
import { ToastViewport } from "@/components/ui/Toast";
import { getCurrentClubId } from "@/lib/current-club";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://cheongwoo-league.vercel.app"),
  title: "청우회 리그",
  description: "테니스 경기 · 랭킹 · 출석관리",
  openGraph: {
    title: "청우회 리그",
    description: "테니스 경기 · 랭킹 · 출석관리",
    url: "https://cheongwoo-league.vercel.app",
    siteName: "청우회 리그",
    images: [
      {
        url: "/og/chungwoo-og.png",
        width: 1200,
        height: 630,
        alt: "청우회 리그",
      },
    ],
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "청우회 리그",
    description: "테니스 경기 · 랭킹 · 출석관리",
    images: ["/og/chungwoo-og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0B1929",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const currentClubId = await getCurrentClubId();

  return (
    <html lang="ko">
      <body className="font-body">
        <MemberAuthBar currentClubId={currentClubId} />
        <div className="mx-auto min-h-screen max-w-md pb-20">{children}</div>
        <BottomTabBar />
        <ToastViewport />
      </body>
    </html>
  );
}
