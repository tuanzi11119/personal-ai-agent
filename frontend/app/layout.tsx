import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "个人 AI 分身 | Personal AI Agent Platform",
  description:
    "把你的经历、项目与知识，构建成一个可对话的个人 AI 分身：RAG 知识库、人设提示词、公开分享链接。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-background">{children}</body>
    </html>
  );
}
