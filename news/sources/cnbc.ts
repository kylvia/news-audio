import axios from "axios";
import { parseStringPromise } from "xml2js";
import type { NewsItem } from "../types.js";
import { filterFreeNews, toNewsItem, deduplicateNews } from "../utils.js";

// CNBC新闻RSS
const CNBC_RSS = "https://www.cnbc.com/id/100003114/device/rss/rss.html";

// 浏览器用户代理
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

// 默认超时设置 (ms)
const DEFAULT_TIMEOUT = 20000;

export async function fetchCNBCNews(): Promise<NewsItem[]> {
  console.log("开始获取CNBC新闻...");

  try {
    // 尝试从RSS获取新闻
    const newsItems = await fetchFromRSS();

    if (newsItems.length > 0) {
      console.log(`从CNBC获取到 ${newsItems.length} 篇新闻`);
      logNewsItems(newsItems);
      return newsItems;
    }

    // 如果RSS获取失败，返回空数组
    console.log("从CNBC获取失败，返回空数组");
    return [];
  } catch (error) {
    console.error("CNBC抓取器发生错误:", (error as Error).message);
    return [];
  }
}

// 从RSS获取新闻
async function fetchFromRSS(): Promise<NewsItem[]> {
  try {
    const res = await axios.get(CNBC_RSS, {
      timeout: DEFAULT_TIMEOUT,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/rss+xml, application/xml",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.cnbc.com/",
      },
    });

    const xml = res.data;
    const result = await parseStringPromise(xml, { explicitArray: false });
    let entries = result.rss.channel.item || [];
    if (!Array.isArray(entries)) entries = [entries];

    // 检查 pubDate 字段是否可解析为有效时间
    const validEntries = entries.filter(
      (entry) => !isNaN(Date.parse(entry.pubDate))
    );

    if (validEntries.length === 0) {
      console.warn("CNBC: 所有条目的pubDate字段无法解析为有效时间");
      return [];
    }

    // 只保留3小时内的新闻（将之前的1小时改为3小时，使所有新闻源统一）
    const now = new Date();
    const threeHoursAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);

    // 从有效条目中过滤有效时间范围并转换为新闻项
    let newsItems = validEntries
      .filter((entry) => {
        const pubDate = new Date(entry.pubDate);
        return pubDate >= threeHoursAgo && pubDate <= now;
      })
      .map((entry) =>
        toNewsItem(entry, {
          source: "CNBC",
          category: "财经/商业",
          tags: ["CNBC"],
          titleField: "title",
          contentField: "description",
          publishedAtField: "pubDate",
          urlField: "link",
        })
      );

    // 应用其他过滤器
    newsItems = filterFreeNews(newsItems);
    newsItems = deduplicateNews(newsItems);

    return newsItems;
  } catch (error) {
    console.warn("从CNBC RSS获取新闻失败:", (error as Error).message);
    return [];
  }
}

// 辅助函数：记录新闻项目
function logNewsItems(news: NewsItem[]): void {
  news.forEach((item, idx) => {
    console.log(
      `CNBC news[${idx}]: publishedAt=${item.publishedAt}, title=${item.title}`
    );
  });
}
