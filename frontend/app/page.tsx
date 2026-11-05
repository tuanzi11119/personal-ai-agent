import Link from "next/link";
import { ArrowRight, Blocks, FileUp, Link2, PenLine, UserRound } from "lucide-react";
import { HomeDemo } from "@/components/home-demo";
import { SiteHeader } from "@/components/site-header";
import { StepTimeline, type TimelineStep } from "@/components/step-timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const steps = [
  { icon: UserRound, title: "注册账号", body: "用邮箱注册，几秒钟进入你的个人控制台。" },
  { icon: PenLine, title: "设定人设", body: "填写名称、简介、头像，以及分身必须遵守的回答规则。" },
  { icon: FileUp, title: "上传资料", body: "上传 PDF、TXT 或 Markdown，系统自动解析、切分并向量化。" },
  { icon: Link2, title: "分享链接", body: "开启公开访问，把 /a/你的slug 发给面试官或朋友。" },
];

const templates = [
  { name: "求职分身", tag: "面试", body: "面向面试官，只根据简历和项目笔记回答，不编造经历。" },
  { name: "项目讲解", tag: "项目", body: "按仓库文档介绍架构取舍，以及你实际负责的部分。" },
  { name: "课程助教", tag: "教学", body: "基于课件回答概念题，并在回答里标出出处。" },
];

const trace: TimelineStep[] = [
  {
    id: "retrieve",
    title: "retrieve",
    subtitle: "检索知识",
    status: "success",
    durationMs: 120,
    tokens: 860,
    prompt: "query: 他做过哪些项目？\nfilter: agent_id = demo\ntop_k: 4",
    output: "简历.pdf #3  score 0.82\n项目笔记.md #1  score 0.74",
  },
  {
    id: "llm_call",
    title: "llm_call",
    subtitle: "生成回答",
    status: "success",
    durationMs: 860,
    tokens: 420,
    prompt: "system: 你是候选人的 AI 数字分身。优先根据知识库回答，不许编造经历。\nuser: 他做过哪些项目？",
    output: "根据知识库，他在 2023 年用 Python 与 FastAPI 搭建了一个简历解析服务。",
  },
  {
    id: "stream",
    title: "stream",
    subtitle: "流式输出",
    status: "running",
    durationMs: 140,
    tokens: 86,
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 lg:grid-cols-2 lg:py-20">
          <div className="space-y-6">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Create Your Personal AI Twin
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
              创建你的个人 AI 分身
            </h1>
            <p className="max-w-xl text-base text-muted-foreground">
              把你的经历、项目与知识，变成一个可以对话的 AI 身份；面试官可以直接向它了解你。
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/register">
                <Button size="lg">
                  开始创建 <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="secondary">
                  我已经有账号
                </Button>
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              没有 API Key 也能用 Mock 模式完整体验 · 随时可接入任意 OpenAI 兼容模型。
            </p>
          </div>
          <HomeDemo />
        </section>

        <section className="border-y">
          <div className="mx-auto max-w-6xl space-y-8 px-6 py-14">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">四步创建你的分身</h2>
              <p className="text-sm text-muted-foreground">从空账号到一条可分享的分身链接，只需要四步。</p>
            </div>
            <ol className="relative grid gap-6 md:grid-cols-4">
              <span className="absolute left-5 right-5 top-5 hidden h-px bg-border md:block" aria-hidden />
              {steps.map((step, index) => (
                <li key={step.title} className="relative">
                  <div className="relative flex flex-col gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-[8px] border bg-background">
                      <step.icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-xs text-muted-foreground">0{index + 1}</p>
                      <p className="text-base font-medium leading-[1.25]">{step.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl space-y-6 px-6 py-14">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">模板 bot</h2>
              <p className="text-sm text-muted-foreground">预设人设与回答边界，创建分身时可以直接套用。</p>
            </div>
            <Badge variant="outline">示例 · 即将上线</Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {templates.map((template) => (
              <Card key={template.name}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>{template.name}</CardTitle>
                    <Badge variant="secondary">{template.tag}</Badge>
                  </div>
                  <CardDescription>{template.body}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Blocks className="h-3.5 w-3.5" />
                    模板尚未开放创建
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="border-t">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 py-14 lg:grid-cols-[240px_minmax(0,1fr)]">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">调用链</h2>
              <p className="text-sm text-muted-foreground">一次提问会经过检索、模型调用和流式输出。下面是一条示例轨迹。</p>
              <Badge variant="outline">示例</Badge>
            </div>
            <Card>
              <CardContent className="p-5">
                <StepTimeline steps={trace} />
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="border-t">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-6 py-14">
            <h2 className="text-xl font-semibold">准备好见见你的 AI 分身了吗？</h2>
            <p className="max-w-xl text-sm text-muted-foreground">
              创建一个 Agent，上传简历，几分钟内就能生成一条属于你的公开链接。
            </p>
            <Link href="/register">
              <Button>
                创建我的 Agent <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>
      <footer className="border-t py-5">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <span>个人 AI 分身平台 · MVP</span>
          <span>FastAPI · Next.js · PostgreSQL + pgvector</span>
        </div>
      </footer>
    </div>
  );
}
