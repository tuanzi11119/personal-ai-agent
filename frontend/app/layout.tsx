import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Noto_Sans_SC } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const noto = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto",
  display: "swap",
  preload: false,
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "个人 AI 分身 | Personal AI Agent Platform",
  description:
    "把你的经历、项目与知识，构建成一个可对话的个人 AI 分身：RAG 知识库、人设提示词、公开分享链接。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className={`${inter.variable} ${noto.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-background font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
