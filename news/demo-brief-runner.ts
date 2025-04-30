import "dotenv/config";
import { fetchAllNewsFromGNews } from "./index.js";
import { generateStoryBrief } from "./deepseek.js";
import { ossTextClient } from "./oss.js";

// 检查简报是否已存在
async function checkExistingBriefs(briefs: StoryBrief[]): Promise<StoryBrief[]> {
  if (briefs.length === 0) return [];

  let existingBriefs: any[] = [];
  try {
    const res = await ossTextClient.get("briefs.json");
    existingBriefs = JSON.parse(res.content.toString());
    console.log(`[检查重复] 已从 briefs.json 读取到 ${existingBriefs.length} 条简报`);
  } catch (e) {
    console.log("[检查重复] briefs.json 不存在，跳过重复检查");
    return briefs; // 如果没有 briefs.json，直接返回所有简报
  }

  // 过滤掉已存在的简报
  const filteredBriefs = briefs.filter(brief => {
    const exists = existingBriefs.some(existing => existing.url === brief.url);
    if (exists) {
      console.log(`[检查重复] 跳过已存在简报: ${brief.title} (${brief.url})`);
      return false;
    }
    return true;
  });

  console.log(`[检查重复] 需要生成新音频的简报数量: ${filteredBriefs.length} / ${briefs.length}`);
  return filteredBriefs;
}
import { synthesizeTTSBatch } from "./tts.js";
import {
  uploadAudioToOSS,
  generateAndUploadBriefsSummaryAppend,
} from "./oss.js";
import { StoryBrief } from "./types.js";
import axios from "axios";
import { DEEPSEEK_API_KEY } from "./deepseek.js";

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

export async function translateTitleToChinese(title: string): Promise<string> {
  const prompt = `请将下列英文标题翻译为简洁、自然的中文新闻标题，仅返回翻译结果：\n${title}`;
  const messages = [{ role: "user", content: prompt }];
  const res = await axios.post(
    DEEPSEEK_API_URL,
    {
      model: "deepseek-chat",
      messages,
      temperature: 0.2,
      max_tokens: 64,
    },
    {
      headers: {
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );
  const translation = res.data.choices?.[0]?.message?.content?.trim() || "";
  return translation;
}

// 控制并发执行的辅助函数
async function concurrentMap<T, R>(
  items: T[],
  mapper: (item: T, idx: number) => Promise<R>,
  concurrency = 3
): Promise<R[]> {
  const results: R[] = [];
  let idx = 0;
  let running: { p: Promise<{ i: number; value: R }>; i: number }[] = [];

  async function run(i: number) {
    const value = await mapper(items[i], i);
    return { i, value };
  }

  while (idx < items.length) {
    if (running.length < concurrency) {
      const p = run(idx);
      running.push({ p, i: idx });
      idx++;
    } else {
      const settled = await Promise.race(running.map((r) => r.p));
      const settleIdx = running.findIndex((r) => r.i === settled.i);
      if (settleIdx !== -1) running.splice(settleIdx, 1);
      results[settled.i] = settled.value;
    }
  }
  const settledAll = await Promise.all(running.map((r) => r.p));
  for (const s of settledAll) {
    if (s) results[s.i] = s.value;
  }
  return results;
}

// 主流程优化版
export async function main() {
  // 1. 拉取新闻
  let newsList = await fetchAllNewsFromGNews();
  if (newsList.length === 0) {
    console.log("未抓取到新闻数据");
    return;
  }

  // 1.5 用 deepseek 做一次相似内容去重
  try {
    const prompt = `请帮我对下面的新闻列表做相似内容聚类，去除内容高度重复的项，仅保留每组中最有代表性的一条。请返回去重后新闻的原始标题列表（每行一个标题，不要编号）：\n${newsList
      .map((n) => n.title)
      .join("\n")}`;
    const messages = [{ role: "user", content: prompt }];
    const res = await axios.post(
      DEEPSEEK_API_URL,
      {
        model: "deepseek-chat",
        messages,
        temperature: 0.2,
        max_tokens: 1024,
      },
      {
        headers: {
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    const dedupTitles =
      res.data.choices?.[0]?.message?.content
        ?.split(/\r?\n/)
        .map((t) => t.trim())
        .filter(Boolean) || [];
    const oldLen = newsList.length;
    newsList = newsList.filter((n) => dedupTitles.includes(n.title));
    console.log(`[DeepSeek去重] 原始${oldLen}条，去重后${newsList.length}条`);
  } catch (err) {
    console.warn("[DeepSeek去重] 失败，继续使用原始新闻", err);
  }

  // 2. 并发生成简报
  const briefs: (StoryBrief | null)[] = await concurrentMap(
    newsList,
    async (news, i) => {
      try {
        const zhTitle = await translateTitleToChinese(news.title);
        const newsWithZhTitle = { ...news, title: zhTitle };
        console.log(`[${i + 1}] ${zhTitle}`);
        const story = await generateStoryBrief(newsWithZhTitle);
        return { ...story, title: zhTitle };
      } catch (err) {
        console.warn(`生成简报失败: ${news.title}`, err);
        return null;
      }
    },
    3
  );
  const validBriefs: StoryBrief[] = briefs.filter(Boolean) as StoryBrief[];

  // 3. 检查重复
  const filteredBriefs = await checkExistingBriefs(validBriefs);

  // 4. 并发批量TTS
  const ttsResults = await synthesizeTTSBatch(filteredBriefs, 3);

  // 4. 并发上传音频并清理本地
  const fs = await import("fs/promises");
  const newBriefs = await concurrentMap(
    ttsResults,
    async (tts, i) => {
      if (!tts) return null;
      try {
        const audioOssUrl = await uploadAudioToOSS(
          tts.audioPath,
          `${validBriefs[i].title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "_")}_${
            tts.briefId
          }.mp3`
        );
        await fs.unlink(tts.audioPath);
        return {
          id: `${validBriefs[i].title.replace(
            /[^a-zA-Z0-9\u4e00-\u9fa5]/g,
            "_"
          )}_${tts.briefId}`,
          title: validBriefs[i].title,
          brief: validBriefs[i].brief,
          category: validBriefs[i].category,
          publishedAt: validBriefs[i].publishedAt,
          audioUrl: audioOssUrl,
          url: validBriefs[i].url,
        };
      } catch (err) {
        console.warn("音频上传或清理失败", err);
        return null;
      }
    },
    3
  );
  const finalBriefs = newBriefs.filter(Boolean);

  // 5. 聚合汇总
  await generateAndUploadBriefsSummaryAppend(finalBriefs);
  console.log(`本轮处理完成，生成音频简报 ${finalBriefs.length} 条`);
}

// 仅 CLI 直接运行时执行
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
