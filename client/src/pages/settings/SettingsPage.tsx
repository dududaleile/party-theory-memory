/**
 * 设置页
 *
 * 五个区块：
 *   ① AI 配置（Provider / Key / Model / 测试连接）
 *   ② 知识库管理（导入 / 导出 / 备份）
 *   ③ 学习偏好（每日上限 / 提醒）
 *   ④ 数据统计（总览 + 领域掌握度）
 *   ⑤ 危险操作（清空数据）
 */

import { useEffect, useState } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { useDomainStore } from "@/stores/domainStore";
import { useUIStore } from "@/stores/uiStore";

export function SettingsPage() {
  const store = useSettingsStore();
  const domainLoaded = useDomainStore((s) => s.isLoaded);
  const loadDomains = useDomainStore((s) => s.loadAll);
  const showToast = useUIStore((s) => s.showToast);

  const [apiKeyInput, setApiKeyInput] = useState("");
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [importText, setImportText] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractStatus, setExtractStatus] = useState("");

  useEffect(() => {
    store.loadSettings();
    if (!domainLoaded) loadDomains();
  }, []);

  // ── 测试连接 ──
  async function handleTestConnection() {
    if (apiKeyInput) {
      await store.updateSetting("aiEncryptedKey", apiKeyInput);
    }
    const result = await store.testAiConnection();
    setTestResult(result);
    if (result.ok) {
      showToast({ type: "success", message: "AI 连接成功", duration: 3000 });
    }
  }

  // ── 导出 ──
  async function handleExport() {
    const json = await store.exportAllData();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `party-theory-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast({ type: "success", message: "数据导出成功", duration: 3000 });
  }

  // ── 导入备份 ──
  async function handleImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        await store.importAllData(text);
        showToast({ type: "success", message: "数据导入成功", duration: 3000 });
        await store.loadSettings();
        await loadDomains();
      } catch {
        showToast({ type: "error", message: "JSON 格式无效", duration: 3000 });
      }
    };
    input.click();
  }

  // ── 图片导入（视觉识别 + 知识提炼）──
  async function handleImageImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.multiple = true;
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;
      if (files.length > 5) {
        showToast({ type: "error", message: "最多上传 5 张图片", duration: 3000 });
        return;
      }

      setIsExtracting(true);
      setExtractStatus("正在识别图片文字…");

      // 转换为 base64
      const images: Array<{ data: string; mediaType: string }> = [];
      for (const file of files) {
        const data = await fileToBase64(file);
        images.push({
          data: data.split(",")[1], // 去掉 data:xxx;base64, 前缀
          mediaType: file.type,
        });
      }

      try {
        setExtractStatus("AI 正在提炼知识点…");
        const apiKey = apiKeyInput || "";
        const res = await fetch("/api/ai/vision-extract", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify({ images }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "请求失败" }));
          throw new Error(err.error || `HTTP ${res.status}`);
        }

        const result = await res.json();
        showToast({
          type: "success",
          message: `识别完成！提取 ${result.points?.length || 0} 个知识点，${result.stats?.domainCount || 0} 个领域`,
          duration: 5000,
        });
        setExtractStatus("");

        // 刷新统计
        await store.refreshStats();
        await loadDomains();
      } catch (err) {
        showToast({
          type: "error",
          message: `识别失败: ${(err as Error).message.slice(0, 50)}`,
          duration: 4000,
        });
        setExtractStatus("");
      } finally {
        setIsExtracting(false);
      }
    };
    input.click();
  }

  // ── 一键导入产品卡片 ──
  async function handleQuickImport() {
    setImportText("__importing__");
    setIsExtracting(true);
    setExtractStatus("正在导入 253 张知识卡片…");
    try {
      const res = await fetch("/data/indexeddb-import.json"); // 打包在 public/data/ 下
      if (!res.ok) throw new Error("文件加载失败");
      const data = await res.json();
      await useDomainStore.getState().directImport(
        data.domains,
        data.points,
        data.cards
      );
      showToast({ type: "success", message: `导入成功！${data.points.length} 张卡片已就绪`, duration: 5000 });
      await store.refreshStats();
      await loadDomains();
    } catch (e) {
      showToast({ type: "error", message: "导入失败: " + (e as Error).message, duration: 4000 });
    } finally {
      setIsExtracting(false);
      setExtractStatus("");
      setImportText("");
    }
  }

  // ── 清空 ──
  async function handleClearAll() {
    await store.clearAllData();
    setShowClearConfirm(false);
    showToast({ type: "success", message: "所有数据已清空", duration: 3000 });
    await loadDomains();
  }

  return (
    <div className="scroll-container">
      <div className="px-5 pt-6 pb-8">
        <h1 className="text-page-title text-text-primary mb-6 select-none">设置</h1>

        {/* ① AI 配置 */}
        <Section title="🤖 AI 配置">
          <Label>API Provider</Label>
          <Select
            value={store.aiProvider}
            onChange={(v) => store.setAiProvider(v)}
            options={[
              { value: "openai", label: "OpenAI" },
              { value: "anthropic", label: "Anthropic Claude" },
              { value: "custom", label: "自定义" },
            ]}
          />

          <Label>API Key</Label>
          <input
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder="sk-..."
            className="w-full h-[44px] bg-gray-50 border border-divider rounded-button px-4 text-body text-text-primary mb-3 focus:outline-none focus:border-brand-blue"
          />

          <Label>模型</Label>
          <Select
            value={store.aiModel}
            onChange={(v) => store.setAiModel(v)}
            options={
              store.aiProvider === "openai"
                ? [{ value: "gpt-4o", label: "GPT-4o" }, { value: "gpt-4o-mini", label: "GPT-4o Mini" }]
                : store.aiProvider === "anthropic"
                ? [{ value: "claude-opus-4-8", label: "Claude Opus 4" }, { value: "claude-sonnet-4-6", label: "Claude Sonnet 4" }]
                : [{ value: "custom", label: "手动输入" }]
            }
          />

          <button
            onClick={handleTestConnection}
            className="w-full h-[40px] bg-white border border-brand-blue text-brand-blue rounded-button text-caption tap-active mb-2"
          >
            测试连接
          </button>
          {testResult && (
            <p className={`text-caption ${testResult.ok ? "text-semantic-success" : "text-semantic-danger"}`}>
              {testResult.ok ? "✅" : "❌"} {testResult.message}
            </p>
          )}
        </Section>

        {/* ② 知识库管理 */}
        <Section title="📦 知识库管理">
          <ActionRow icon="📋" label="粘贴文本导入" onClick={() => setImportText("__show__")} />
          <ActionRow icon="🖼" label="导入图片/PPT截图" onClick={handleImageImport} />
          <ActionRow icon="⚡" label="一键导入 253 张党课知识卡片" onClick={handleQuickImport} />
          <ActionRow icon="📤" label="导出数据 (JSON)" onClick={handleExport} />
          <ActionRow icon="📥" label="导入备份 (JSON)" onClick={handleImport} />

          {/* 提取状态 */}
          {isExtracting && (
            <div className="mt-3 flex items-center gap-3 px-4 py-3 bg-blue-50 rounded-tag">
              <div className="w-5 h-5 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
              <p className="text-caption text-brand-blue">{extractStatus}</p>
            </div>
          )}

          {/* 简易导入弹窗 */}
          {importText === "__show__" && (
            <div className="mt-3 p-4 bg-gray-50 rounded-card">
              <p className="text-caption text-text-secondary mb-2">
                粘贴党课理论知识文本，AI 将自动提炼知识点
              </p>
              <textarea
                value=""
                onChange={(e) => setImportText(e.target.value)}
                placeholder="在此粘贴党课教材、笔记、讲义…"
                className="w-full min-h-[120px] bg-white border border-divider rounded-tag px-3 py-2 text-body text-text-primary resize-none focus:outline-none focus:border-brand-blue"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setImportText("")}
                  className="flex-1 h-[36px] bg-gray-200 text-text-secondary rounded-button text-caption"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    // V1: 触发提炼（目前由后端处理）
                    showToast({ type: "info", message: "知识提炼功能将在后端就绪后启用", duration: 3000 });
                    setImportText("");
                  }}
                  className="flex-1 h-[36px] bg-brand-blue text-white rounded-button text-caption"
                >
                  开始 AI 提炼
                </button>
              </div>
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-divider">
            <p className="text-caption text-text-tertiary">
              知识点：{store.totalPoints} · 卡片：{store.totalCards} · 已掌握：{store.masteredCards}
            </p>
          </div>
        </Section>

        {/* ③ 学习偏好 */}
        <Section title="⚙️ 学习偏好">
          <div className="flex items-center justify-between mb-3">
            <Label>每日新卡片数</Label>
            <Stepper
              value={store.dailyNewCardLimit}
              onChange={(v) => { store.updateSetting("dailyNewCardLimit", v); }}
              min={5} max={50} step={5}
            />
          </div>
          <div className="flex items-center justify-between mb-3">
            <Label>每日复习上限</Label>
            <Stepper
              value={store.dailyReviewLimit}
              onChange={(v) => { store.updateSetting("dailyReviewLimit", v); }}
              min={10} max={200} step={10}
            />
          </div>
          <div className="flex items-center justify-between mb-3">
            <Label>提醒时间</Label>
            <input
              type="time"
              value={store.reminderTime}
              onChange={(e) => store.updateSetting("reminderTime", e.target.value)}
              className="bg-gray-50 border border-divider rounded-button px-3 py-1.5 text-body text-text-primary focus:outline-none focus:border-brand-blue"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>每日提醒</Label>
            <Toggle
              checked={store.reminderEnabled}
              onChange={(v) => store.updateSetting("reminderEnabled", v)}
            />
          </div>
        </Section>

        {/* ④ 数据统计 */}
        <Section title="📊 数据统计">
          <StatRow label="总知识点" value={store.totalPoints} />
          <StatRow label="总卡片" value={store.totalCards} />
          <StatRow label="已掌握" value={`${store.masteredCards} (${store.totalCards > 0 ? Math.round(store.masteredCards / store.totalCards * 100) : 0}%)`} />
          <StatRow label="累计复习" value={`${store.totalReviews} 次`} />
          <StatRow label="学习天数" value={`${store.totalStudyDays} 天`} />

          {store.domainStats.length > 0 && (
            <div className="mt-3 pt-3 border-t border-divider">
              <p className="text-caption text-text-tertiary mb-2">各领域掌握度</p>
              {store.domainStats.map((d) => (
                <div key={d.name} className="flex items-center justify-between mb-1.5">
                  <span className="text-caption text-text-secondary truncate flex-1 mr-2">{d.name}</span>
                  <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        d.percentage >= 90 ? "bg-semantic-success" :
                        d.percentage >= 70 ? "bg-brand-blue" :
                        d.percentage >= 40 ? "bg-semantic-warning" : "bg-semantic-danger"
                      }`}
                      style={{ width: `${d.percentage}%` }}
                    />
                  </div>
                  <span className="text-label text-text-tertiary ml-2 w-8 text-right">{d.percentage}%</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ⑤ 危险操作 */}
        <Section title="⚠️ 危险操作">
          {!showClearConfirm ? (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="text-caption text-semantic-danger tap-active"
            >
              清空所有学习数据
            </button>
          ) : (
            <div className="bg-red-50 rounded-tag px-4 py-3">
              <p className="text-caption text-semantic-danger mb-2">
                确认清空所有数据？此操作不可恢复。
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 h-[36px] bg-gray-200 text-text-secondary rounded-button text-caption"
                >
                  取消
                </button>
                <button
                  onClick={handleClearAll}
                  className="flex-1 h-[36px] bg-semantic-danger text-white rounded-button text-caption"
                >
                  确认清空
                </button>
              </div>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

// ── 工具函数 ──

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}

// ── 子组件 ──

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-card shadow-card px-5 py-5 mb-4">
      <h3 className="text-card-title text-text-primary mb-3 select-none">{title}</h3>
      {children}
    </div>
  );
}

function Label({ children }: { children: string }) {
  return <p className="text-caption text-text-secondary mb-1.5">{children}</p>;
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-[44px] bg-gray-50 border border-divider rounded-button px-4 text-body text-text-primary mb-3 focus:outline-none focus:border-brand-blue appearance-none"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function ActionRow({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 py-3 tap-active border-b border-divider last:border-b-0 text-left"
    >
      <span className="text-lg select-none">{icon}</span>
      <span className="text-body text-text-primary">{label}</span>
      <span className="ml-auto text-text-tertiary text-body">›</span>
    </button>
  );
}

function Stepper({ value, onChange, min, max, step }: {
  value: number; onChange: (v: number) => void; min: number; max: number; step: number;
}) {
  return (
    <div className="flex items-center gap-0 rounded-button overflow-hidden border border-divider">
      <button
        onClick={() => onChange(Math.max(min, value - step))}
        className="w-[36px] h-[36px] flex items-center justify-center bg-gray-50 text-text-secondary tap-active"
      >−</button>
      <span className="w-[48px] text-center text-body text-text-primary font-medium">{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + step))}
        className="w-[36px] h-[36px] flex items-center justify-center bg-gray-50 text-text-secondary tap-active"
      >+</button>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-[44px] h-[26px] rounded-full transition-colors ${
        checked ? "bg-semantic-success" : "bg-gray-300"
      }`}
    >
      <div
        className={`absolute top-[2px] w-[22px] h-[22px] bg-white rounded-full shadow transition-transform ${
          checked ? "translate-x-[20px]" : "translate-x-[2px]"
        }`}
      />
    </button>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-caption text-text-secondary">{label}</span>
      <span className="text-body text-text-primary font-medium">{value}</span>
    </div>
  );
}
