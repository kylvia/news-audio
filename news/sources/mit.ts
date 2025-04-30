import axios from "axios";
import { parseStringPromise } from "xml2js";
import type { NewsItem } from "../types.js";
import { filterFreeNews, deduplicateNews } from "../utils.js";

const MIT_RSS = "http://news.mit.edu/rss/topic/artificial-intelligence2";

export async function fetchMITNews(since: string): Promise<NewsItem[]> {
  const res = await axios.get(MIT_RSS, { timeout: 10000 });
  const xml = res.data;
  const result = await parseStringPromise(xml, { explicitArray: false });
  let entries = result.rss.channel.item || [];
  if (!Array.isArray(entries)) entries = [entries];

  // 检查 published 字段是否可解析为有效时间
  const allInvalid = entries.every((entry: any) =>
    isNaN(Date.parse(entry.pubDate))
  );
  if (allInvalid) {
    console.warn(
      "MIT News: 所有 entry 的 pubDate 字段无法解析为有效时间，只返回最新2条！"
    );
    let news = entries.slice(0, 2).map((entry: any) => ({
      title: entry.title.trim(),
      content: entry.description.trim(),
      source: "MIT",
      publishedAt: entry.pubDate,
      url: entry.link,
      category: "AI",
      tags: ["AI"],
    }));
    news = filterFreeNews(news);
    news = deduplicateNews(news);
    news.forEach((item, idx) => {
      console.log(
        `MIT news[${idx}]: publishedAt=${item.publishedAt}, title=${item.title}`
      );
    });
    return news;
  }

  const filtered = entries.filter((entry: any) => !isNaN(Date.parse(entry.pubDate)));
  // 新增：只保留一小时内的新闻
  const now = new Date();
  let news = filtered
    .filter((entry: any) => {
      const pubDate = new Date(entry.pubDate);
      const diffMs = now.getTime() - pubDate.getTime();
      return diffMs >= 0 && diffMs <= 60 * 60 * 1000;
    })
    .map((entry: any) => ({
      title: entry.title.trim(),
      content: entry.description.trim(),
      source: "MIT",
      publishedAt: entry.pubDate,
      url: entry.link,
      category: "AI",
      tags: ["AI"],
    }));
  news = filterFreeNews(news);
  news = deduplicateNews(news);
  news.forEach((item, idx) => {
    console.log(
      `MIT news[${idx}]: publishedAt=${item.publishedAt}, title=${item.title}`
    );
  });
  return news;
}
