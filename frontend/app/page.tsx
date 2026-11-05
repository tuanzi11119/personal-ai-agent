import Link from "next/link";
import { ArrowRight, Bot, FileText, Lock, MessagesSquare, Share2, Sparkles } from "lucide-react";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const steps = [
  { title: "注册账号", body: "用邮箱注册，几秒钟进入你的个人控制台。" },
  { title: "设定人设", body: "填写名称、简介、头像，以及分身必须遵守的回答规则。" },
  { title: "上传资料", body: "上传 PDF、TXT 或 Markdown，系统自动解析、切分并向量化。" },
  { title: "分享链接", body: "开启公开访问，把 /a/你的slug 发给面试官或朋友。" },
];

const features = [
  {
    icon: FileText,
    title: "属于你的知识库",
    body: "每份文档都会被解析、切分并向量化，回答基于检索到的真实段落，而不是模型的凭空想象。",
  },
  {
    icon: Lock,
    title: "严格的多租户隔离",
    body: "每次检索都按 agent_id 过滤；私有 Agent 的公开接口一律返回 404。",
  },
  {
    icon: MessagesSquare,
    title: "多轮对话",
    body: "控制台测试与公开页面都会保留对话上下文，每条回答都能列出知识来源。",
  },
  {
    icon: Share2,
    title: "可分享的数字分身",
    body: "一键公开，生成类似 ChatGPT 的对话页面，访客无需注册即可提问。",
  },
  {
    icon: Bot,
    title: "接入你自己的模型",
    body: "支持任意 OpenAI 兼容接口；没有 API Key 时可用 Mock 模式离线跑通全流程。",
  },
  {
    icon: Sparkles,
    title: "内置安全护栏",
    body: "平台规则优先于人设：不许编造经历，不许泄露私人数据或其他用户资料。",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Bot className="h-4 w-4" />
            </span>
            个人 AI 分身
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost">登录</Button>
            </Link>
            <Link href="/register">
              <Button>开始使用</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="container grid gap-10 py-20 md:grid-cols-2 md:items-center">
          <div className="space-y-6">
            <Badge variant="secondary" className="rounded-full px-3 py-1">
              RAG + 人设提示词 · 无需微调
            </Badge>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Create Your Personal AI Twin
              </p>
              <h1 className="text-balance text-4xl font-semibold tracking-tight md:text-5xl">
                创建你的个人 AI 分身
              </h1>
              <p className="text-sm text-muted-foreground">
                Turn your experience, projects and knowledge into an interactive AI identity.
              </p>
            </div>
            <p className="max-w-xl text-lg text-muted-foreground">
              把你的经历、项目与知识，变成一个可以对话的 AI 身份；面试官可以直接向它了解你。
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/register">
                <Button size="lg">
                  开始创建 <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline">
                  我已经有账号
                </Button>
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              没有 API Key 也能用 Mock 模式完整体验 · 随时可接入任意 OpenAI 兼容模型。
            </p>
          </div>
          <Card className="border-primary/20 bg-gradient-to-br from-accent/70 to-transparent shadow-lg">
            <CardHeader>
              <CardDescription>公开 Agent 页面预览</CardDescription>
              <CardTitle>你好，我是这位候选人的 AI 助手。</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-xl border bg-card px-4 py-3">
                <p className="font-medium">访客</p>
                <p className="text-muted-foreground">他做过哪些项目？</p>
              </div>
              <div className="rounded-xl border bg-primary/5 px-4 py-3">
                <p className="font-medium">AI 分身</p>
                <p className="text-muted-foreground">
                  根据知识库，他在 2023 年用 Python 与 FastAPI 搭建了一个简历解析服务……
                </p>
                <p className="mt-2 text-xs text-muted-foreground">来源：简历.pdf #3、项目笔记.md #1</p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="border-y bg-muted/30 py-16">
          <div className="container space-y-8">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">四步创建你的分身</h2>
              <p className="text-muted-foreground">从空账号到一条可分享的分身链接，只需要四步。</p>
            </div>
            <ol className="grid gap-4 md:grid-cols-4">
              {steps.map((step, index) => (
                <li key={step.title}>
                  <Card className="h-full">
                    <CardHeader className="pb-2">
                      <span className="text-xs font-semibold text-primary">第 {index + 1} 步</span>
                      <CardTitle className="text-base">{step.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{step.body}</p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="container space-y-8 py-16">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">为真实面试场景而做</h2>
            <p className="text-muted-foreground">账号、Agent、知识库、RAG 对话、公开分享，形成完整闭环。</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title}>
                <CardHeader className="pb-2">
                  <feature.icon className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{feature.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="border-t bg-primary/5 py-16">
          <div className="container flex flex-col items-center gap-4 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">准备好见见你的 AI 分身了吗？</h2>
            <p className="max-w-xl text-muted-foreground">
              创建一个 Agent，上传简历，几分钟内就能生成一条属于你的公开链接。
            </p>
            <Link href="/register">
              <Button size="lg">
                创建我的 Agent <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t py-6">
        <div className="container flex flex-col items-center justify-between gap-2 text-sm text-muted-foreground md:flex-row">
          <span>个人 AI 分身平台 · MVP</span>
          <span>FastAPI · Next.js · PostgreSQL + pgvector</span>
        </div>
      </footer>
    </div>
  );
}
