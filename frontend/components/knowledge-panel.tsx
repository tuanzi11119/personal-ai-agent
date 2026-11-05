"use client";

import * as React from "react";
import { FileText, RefreshCw, Trash2, Upload } from "lucide-react";
import { api, ApiError, type DocumentItem } from "@/lib/api";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, ErrorBanner, Spinner } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatBytes, formatDate } from "@/lib/utils";

const ACCEPTED = ".pdf,.txt,.md,.markdown";

function statusBadge(status: string) {
  if (status === "ready") return <Badge variant="success">已就绪</Badge>;
  if (status === "error") return <Badge variant="destructive">处理失败</Badge>;
  if (status === "processing") return <Badge variant="secondary">处理中</Badge>;
  if (status === "pending") return <Badge variant="outline">等待处理</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

export function KnowledgePanel({ agentId }: { agentId: string }) {
  const [documents, setDocuments] = React.useState<DocumentItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const load = React.useCallback(async () => {
    try {
      const data = await api.listDocuments(agentId);
      setDocuments(data.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "加载文档列表失败。");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function upload(file: File) {
    setError("");
    setUploading(true);
    try {
      const document = await api.uploadDocument(agentId, file);
      setDocuments((prev) => [document, ...prev.filter((item) => item.id !== document.id)]);
      if (document.status === "error") {
        setError("「" + document.filename + "」处理失败：" + (document.error_message || "未知错误"));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "上传失败。");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(document: DocumentItem) {
    if (!window.confirm("确定删除「" + document.filename + "」吗？它的分块与向量会一并删除。")) return;
    try {
      await api.deleteDocument(agentId, document.id);
      setDocuments((prev) => prev.filter((item) => item.id !== document.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "删除文档失败。");
    }
  }

  return (
    <div className="space-y-4">
      {error ? <ErrorBanner message={error} onDismiss={() => setError("")} /> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">上传知识</CardTitle>
          <CardDescription>
            支持 PDF、TXT、Markdown，单个文件不超过 10 MB。文件会立即解析、切分并向量化，
            并且只有这个 Agent 能检索到它。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const file = event.dataTransfer.files?.[0];
              if (file && !uploading) void upload(file);
            }}
            className={"flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors " +
              (dragging ? "border-primary bg-accent/60" : "border-input")}
          >
            {uploading ? <Spinner /> : <Upload className="h-5 w-5 text-muted-foreground" />}
            <p className="text-sm text-muted-foreground">
              {uploading ? "正在上传并建立索引…" : "把文件拖到这里，或者"}
            </p>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED}
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
              }}
            />
            <Button variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
              选择文件
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">文档</CardTitle>
            <CardDescription>知识库中共 {documents.length} 份文件</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-3.5 w-3.5" />
            刷新
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner /> 正在加载文档…
            </div>
          ) : documents.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              还没有文档。上传简历或项目笔记，让回答有据可依。
            </p>
          ) : (
            <ul className="divide-y">
              {documents.map((document) => (
                <li key={document.id} className="flex flex-wrap items-center gap-3 py-3">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{document.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(document.size_bytes)} · {document.chunk_count} 个分块 · {formatDate(document.created_at)}
                    </p>
                    {document.status === "error" && document.error_message ? (
                      <p className="mt-1 text-xs text-destructive">{document.error_message}</p>
                    ) : null}
                  </div>
                  {statusBadge(document.status)}
                  <Button variant="ghost" size="icon" aria-label="删除文档" onClick={() => void remove(document)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
