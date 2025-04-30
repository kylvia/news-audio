import axios from "axios";
import type { NewsItem } from "../types.js";

const GNEWS_API_KEY = process.env.GNEWS_API_KEY;
const GNEWS_URL = "https://gnews.io/api/v4/top-headlines";

const CATEGORIES = ["business", "technology"];
// const COUNTRIES = ["us", "cn"];
const COUNTRIES = ["us"];

function deduplicateNews(news: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  return news.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

export async function fetchAllNewsFromGNews(pageSize = 3): Promise<NewsItem[]> {
  if (!GNEWS_API_KEY) {
    throw new Error("GNEWS_API_KEY is not set in environment variables");
  }

  // 计算时间窗口（GNews支持from/to参数，格式为yyyy-MM-dd'T'HH:mm:ss'Z'）
  const now = new Date();
  const to = now.toISOString();
  const from = new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString();

  const allNews: NewsItem[] = [];
  for (const category of CATEGORIES) {
    for (const country of COUNTRIES) {
      if (category === "technology" && country === "cn") {
        continue;
      }
      try {
        const params: any = {
          apikey: GNEWS_API_KEY,
          category,
          country,
          max: pageSize,
          from,
          to,
          sortby: "publishedAt",
          expand: "content",
        };
        const response = await axios.get(GNEWS_URL, { params });
        const { articles } = response.data;
        if (Array.isArray(articles)) {
          allNews.push(
            ...articles.map((a: any) => ({
              title: a.title || "",
              content: a.content || "",
              description: a.description || "",
              source: a.source?.name || "",
              publishedAt: a.publishedAt,
              url: a.url,
              category,
              country,
            }))
          );
        }
      } catch (error) {
        console.warn(
          `GNews 获取 ${category} (${country}) 新闻失败:`,
          (error as any)?.response?.data || (error as Error).message
        );
      }
    }
  }
  return deduplicateNews(allNews);
}
