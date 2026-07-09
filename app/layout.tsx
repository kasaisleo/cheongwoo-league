import type { Metadata, Viewport } from "next";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { MemberAuthBar } from "@/components/layout/MemberAuthBar";
import { ToastViewport } from "@/components/ui/Toast";
import { getCurrentClubId } from "@/lib/current-club";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://supermatch-tennis.vercel.app"),
  title: "슈퍼매치 | 테니스 클럽 매치 관리",
  description: "테니스 경기 · 랭킹 · 출석관리",
  openGraph: {
    title: "슈퍼매치 | 테니스 클럽 매치 관리",
    description: "테니스 경기 · 랭킹 · 출석관리",
    url: "https://supermatch-tennis.vercel.app",
    siteName: "슈퍼매치",
    images: [
      {
        url: "/og/club-match-og.png",
        width: 1200,
        height: 630,
        alt: "슈퍼매치 테니스 클럽 매치 관리",
      },
    ],
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "슈퍼매치 | 테니스 클럽 매치 관리",
    description: "테니스 경기 · 랭킹 · 출석관리",
    images: ["/og/club-match-og.png"],
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
