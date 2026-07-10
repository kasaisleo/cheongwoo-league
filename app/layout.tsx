import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { BrandHeader } from "@/components/layout/BrandHeader";
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
  const pathname = headers().get("x-pathname") ?? "";
  const showPublicShell =
    !pathname.startsWith("/admin") && !pathname.startsWith("/center-court");

  const currentClubId = showPublicShell ? await getCurrentClubId() : "";

  return (
    <html lang="ko">
      <body className="font-body">
        {showPublicShell && <BrandHeader />}
        {showPublicShell && <MemberAuthBar currentClubId={currentClubId} />}
        <div className={`mx-auto min-h-screen max-w-md${showPublicShell ? " pb-20" : ""}`}>
          {children}
        </div>
        {showPublicShell && <BottomTabBar />}
        <ToastViewport />
      </body>
    </html>
  );
}
