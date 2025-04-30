import axios from "axios";
import type { NewsItem } from "../types.js";

const NEWSAPI_KEY = process.env.NEWSAPI_KEY;
const NEWSAPI_URL = "https://newsapi.org/v2/everything";

const BLOOMBERG_DOMAIN = "bloomberg.com";
const TECHCRUNCH_DOMAIN = "techcrunch.com";
const MIT_DOMAIN = "news.mit.edu";
const CNBC_DOMAIN = "cnbc.com";
const REUTERS_DOMAIN = "reuters.com";
const WSJ_DOMAIN = "wsj.com";
const FT_DOMAIN = "ft.com";
const FORBES_DOMAIN = "forbes.com";
const THEVERGE_DOMAIN = "theverge.com";
const WIRED_DOMAIN = "wired.com";
const TECHNODE_DOMAIN = "technode.com";
const BUSINESSINSIDER_DOMAIN = "businessinsider.com";
const FORTUNE_DOMAIN = "fortune.com";
const NYTIMES_DOMAIN = "nytimes.com";
const BBC_DOMAIN = "bbc.com";
const ARSTECHNICA_DOMAIN = "arstechnica.com";
const VENTUREBEAT_DOMAIN = "venturebeat.com";
const MASHABLE_DOMAIN = "mashable.com";
const TECHRADAR_DOMAIN = "techradar.com";

const DOMAINS = [
  BLOOMBERG_DOMAIN,
  TECHCRUNCH_DOMAIN,
  MIT_DOMAIN,
  CNBC_DOMAIN,
  REUTERS_DOMAIN,
  WSJ_DOMAIN,
  FT_DOMAIN,
  FORBES_DOMAIN,
  THEVERGE_DOMAIN,
  WIRED_DOMAIN,
  TECHNODE_DOMAIN,
  BUSINESSINSIDER_DOMAIN,
  FORTUNE_DOMAIN,
  NYTIMES_DOMAIN,
  BBC_DOMAIN,
  ARSTECHNICA_DOMAIN,
  VENTUREBEAT_DOMAIN,
  MASHABLE_DOMAIN,
  TECHRADAR_DOMAIN,
];

const LANGUAGES = ["en", "zh"];

function filterNewsByLastHour(news: NewsItem[]): NewsItem[] {
  const now = Date.now();
  const oneHourMs = 60 * 60 * 1000;
  return news.filter((item) => {
    const pub = new Date(item.publishedAt).getTime();
    return !isNaN(pub) && now - pub >= 0 && now - pub <= oneHourMs;
  });
}

function deduplicateNews(news: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  return news.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

export async function fetchAllNewsFromNewsAPI(
  pageSize = 20
): Promise<NewsItem[]> {
  if (!NEWSAPI_KEY) {
    throw new Error("NEWSAPI_KEY is not set in environment variables");
  }

  // 计算时间窗口
  const now = new Date();
  const to = now.toISOString();
  const from = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();

  const Q =
    "business OR finance OR startup OR AI OR artificial intelligence OR technology OR science";
  const allNews: NewsItem[] = [];
  for (const language of LANGUAGES) {
    try {
      const params: any = {
        apiKey: NEWSAPI_KEY,
        domains: DOMAINS.join(","),
        language,
        pageSize,
        sortBy: "publishedAt",
        from,
        to,
        q: Q,
      };
      const response = await axios.get(NEWSAPI_URL, { params });
      const { articles } = response.data;
      if (Array.isArray(articles)) {
        allNews.push(
          ...articles.map((a: any) => ({
            title: a.title || "",
            content: a.description || a.content || "",
            source: a.source?.name || "NewsAPI",
            publishedAt: a.publishedAt,
            url: a.url,
            category: undefined, // category 不再区分
            tags: ["NewsAPI", language],
          }))
        );
      }
    } catch (error) {
      console.warn(
        `NewsAPI 获取 ${language} 新闻失败:`,
        (error as Error).message
      );
    }
  }
  return deduplicateNews(allNews);
}
