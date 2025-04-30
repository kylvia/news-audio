import axios from "axios";
import { parseStringPromise } from "xml2js";
import type { NewsItem } from "../types.js";
import { deduplicateNews } from "../utils.js";

const ARXIV_CATEGORIES = ["cs.AI", "cs.LG", "q-fin"];
const ARXIV_API = "http://export.arxiv.org/api/query";

const toNewsItem = (entry: any): NewsItem => ({
  title: entry.title.trim(),
  content: entry.summary.trim(),
  source: "arXiv",
  publishedAt: entry.published, // 保持为 ISO 字符串
  url: Array.isArray(entry.link)
    ? entry.link.find((l: any) => l.$.type === "text/html")?.$.href || entry.id
    : entry.id,
  category: entry.category?.["$"]?.term || "AI",
  tags: ARXIV_CATEGORIES.filter((cat) =>
    entry.category?.["$"]?.term?.includes(cat)
  ),
});

export async function fetchFromArxiv(since: string): Promise<NewsItem[]> {
  // since 必须为 UTC 字符串
  const searchQuery = ARXIV_CATEGORIES.map((cat) => `cat:${cat}`).join("+OR+");
  const url = `${ARXIV_API}?search_query=${searchQuery}&sortBy=submittedDate&sortOrder=descending&max_results=20`;

  const res = await axios.get(url, { timeout: 10000 });
  const xml = res.data;
  const result = await parseStringPromise(xml, { explicitArray: false });

  const entries = Array.isArray(result.feed.entry)
    ? result.feed.entry
    : [result.feed.entry];

  // 统一用 UTC 时间比较
  const sinceTime = new Date(since);
  const now = new Date();

  // 日志输出所有 entry 的 published 时间
  console.log(
    `arXiv sinceTime(UTC): ${sinceTime.toISOString()}, now(UTC): ${now.toISOString()}`
  );
  entries.forEach((entry: any, idx: number) => {
    console.log(
      `arXiv entry[${idx}]: published=${
        entry.published
      }, title=${entry.title?.trim?.()}`
    );
  });

  // 检查 published 字段是否可解析为有效时间
  const allInvalid = entries.every((entry: any) =>
    isNaN(Date.parse(entry.published))
  );
  if (allInvalid) {
    console.warn(
      "arXiv: 所有 entry 的 published 字段无法解析为有效时间，只返回最新2条！"
    );
    let news = entries.slice(0, 2).map(toNewsItem);
    news.forEach((item, idx) => {
      console.log(
        `arXiv news[${idx}]: publishedAt=${item.publishedAt}, title=${item.title}`
      );
    });
    return news;
  }

  const filtered = entries.filter((entry) => {
    const published = new Date(entry.published);
    return published > sinceTime && published <= now;
  });

  // 日志输出过滤后结果
  filtered.forEach((entry: any, idx: number) => {
    console.log(
      `arXiv filtered[${idx}]: published=${
        entry.published
      }, title=${entry.title?.trim?.()}`
    );
  });

  let news = deduplicateNews(filtered.map(toNewsItem));

  // 日志输出最终 news 的 publishedAt
  news.forEach((item, idx) => {
    console.log(
      `arXiv news[${idx}]: publishedAt=${item.publishedAt}, title=${item.title}`
    );
  });

  return news;
}
