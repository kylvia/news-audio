import axios from "axios";
import { parseStringPromise } from "xml2js";
import type { NewsItem } from "../types.js";
import { filterFreeNews, toNewsItem, deduplicateNews } from "../utils.js";
import * as cheerio from "cheerio";

// 华尔街见闻RSS和网站URL
const WALLSTREETCN_RSS = "https://wallstreetcn.com/rss";
const WALLSTREETCN_URL = "https://wallstreetcn.com/live/global";

// 浏览器用户代理
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

// 默认超时设置 (ms)
const DEFAULT_TIMEOUT = 20000;

export async function fetchWallstreetCN(): Promise<NewsItem[]> {
  console.log("开始获取华尔街见闻财经/商业新闻...");

  try {
    // 并行尝试多种获取方式
    const methods = [fetchFromRSS(), fetchFromWebsite()];

    // 使用Promise.any()尝试所有方法，只要有一个成功就使用
    let newsItems: NewsItem[] = [];
    try {
      newsItems = await Promise.any(methods);
    } catch (error) {
      console.log("所有获取华尔街见闻新闻的方法都失败");
    }

    if (newsItems.length > 0) {
      console.log(`从华尔街见闻获取到 ${newsItems.length} 篇新闻`);
      logNewsItems(newsItems);
      return newsItems;
    }

    // 如果所有方法都失败，返回空数组
    console.log("从华尔街见闻获取失败，返回空数组");
    return [];
  } catch (error) {
    console.error("获取华尔街见闻新闻失败:", (error as Error).message);
    return [];
  }
}

// 从RSS获取新闻
async function fetchFromRSS(): Promise<NewsItem[]> {
  try {
    console.log("正在尝试从RSS获取华尔街见闻新闻...");
    const res = await axios.get(WALLSTREETCN_RSS, {
      timeout: DEFAULT_TIMEOUT,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/rss+xml, application/xml",
        "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
        Referer: "https://wallstreetcn.com/",
      },
    });

    const xml = res.data;
    const result = await parseStringPromise(xml, { explicitArray: false });
    let entries = result.rss.channel.item || [];
    if (!Array.isArray(entries)) entries = [entries];

    // 过滤无效条目和转换为新闻项
    return processEntries(entries);
  } catch (error) {
    console.warn("从华尔街见闻RSS获取新闻失败:", (error as Error).message);
    return [];
  }
}

// 从网站直接抓取新闻
async function fetchFromWebsite(): Promise<NewsItem[]> {
  try {
    console.log("正在尝试从网站直接抓取华尔街见闻新闻...");
    const res = await axios.get(WALLSTREETCN_URL, {
      timeout: DEFAULT_TIMEOUT,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
        Referer: "https://wallstreetcn.com/",
      },
    });

    const html = res.data;
    const $ = cheerio.load(html);
    const newsItems: NewsItem[] = [];
    const now = new Date();

    // 查找新闻元素 (注: 选择器可能需要根据当前网站结构调整)
    $(".live-item").each((i, el) => {
      try {
        const titleEl = $(el).find(".live-item-title");
        const title = titleEl.text().trim();
        const url = titleEl.attr("href")
          ? `https://wallstreetcn.com${titleEl.attr("href")}`
          : "";
        const content = $(el).find(".live-item-content").text().trim();
        const timeText = $(el).find(".live-item-time").text().trim();

        // 解析时间 (可能需要根据网站格式调整)
        let publishedAt = now.toISOString();
        try {
          if (timeText) {
            // 尝试解析时间格式如 "12:34" 或 "2025-04-26 12:34"
            const today = new Date().toISOString().split("T")[0];
            const fullTimeText = timeText.includes("-")
              ? timeText
              : `${today} ${timeText}`;
            publishedAt = new Date(fullTimeText).toISOString();
          }
        } catch (e) {
          console.warn("无法解析华尔街见闻时间:", timeText);
        }

        if (title && (content || url)) {
          const newsItem: NewsItem = {
            title,
            content: content || `华尔街见闻最新财经新闻: ${title}`,
            source: "WallstreetCN",
            publishedAt,
            url: url || "https://wallstreetcn.com/",
            category: "财经/商业",
            tags: ["WallstreetCN", "财经"],
          };

          newsItems.push(newsItem);
        }
      } catch (error) {
        console.warn("解析华尔街见闻新闻项出错:", (error as Error).message);
      }
    });

    // 过滤并处理新闻项
    return filterNewsItems(newsItems);
  } catch (error) {
    console.warn("从华尔街见闻网站抓取新闻失败:", (error as Error).message);
    return [];
  }
}

// 处理RSS条目
function processEntries(entries: any[]): NewsItem[] {
  if (!entries || !entries.length) return [];

  // 检查 published 字段是否可解析为有效时间
  const validEntries = entries.filter(
    (entry) => !isNaN(Date.parse(entry.pubDate))
  );

  if (validEntries.length === 0) {
    console.warn("华尔街见闻: 所有条目的pubDate字段无法解析为有效时间");
    // 尝试使用前两条，不考虑日期
    return entries.slice(0, 2).map((entry) =>
      toNewsItem(entry, {
        source: "WallstreetCN",
        category: "财经/商业",
        tags: ["WallstreetCN"],
        titleField: "title",
        contentField: "description",
        publishedAtField: "pubDate",
        urlField: "link",
      })
    );
  }

  // 只保留3小时内的新闻
  const now = new Date();
  const threeHoursAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);

  return validEntries
    .filter((entry) => {
      const pubDate = new Date(entry.pubDate);
      return (
        !isNaN(pubDate.getTime()) && pubDate >= threeHoursAgo && pubDate <= now
      );
    })
    .map((entry) =>
      toNewsItem(entry, {
        source: "WallstreetCN",
        category: "财经/商业",
        tags: ["WallstreetCN"],
        titleField: "title",
        contentField: "description",
        publishedAtField: "pubDate",
        urlField: "link",
      })
    );
}

// 过滤新闻项
function filterNewsItems(newsItems: NewsItem[]): NewsItem[] {
  if (!newsItems || !newsItems.length) return [];

  // 过滤3小时内的内容
  const now = new Date();
  const threeHoursAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);

  let filteredItems = newsItems.filter((item) => {
    try {
      const pubDate = new Date(item.publishedAt);
      return (
        !isNaN(pubDate.getTime()) && pubDate >= threeHoursAgo && pubDate <= now
      );
    } catch (e) {
      return true; // 如果日期解析失败，默认保留
    }
  });

  // 应用其他过滤器
  filteredItems = filterFreeNews(filteredItems);
  filteredItems = deduplicateNews(filteredItems);

  // 限制为最多3条
  return filteredItems.slice(0, 3);
}

// 辅助函数：记录新闻项目
function logNewsItems(news: NewsItem[]): void {
  news.forEach((item, idx) => {
    console.log(
      `WallstreetCN news[${idx}]: publishedAt=${item.publishedAt}, title=${item.title}, url=${item.url}`
    );
  });
}
