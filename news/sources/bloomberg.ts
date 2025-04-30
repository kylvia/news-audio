import axios from "axios";
import type { NewsItem } from "../types.js";

// Bloomberg API接口
const BLOOMBERG_API_URL =
  "https://www.bloomberg.com/lineup-next/api/latest-stories";

// 感兴趣的类别
const CATEGORIES = ["TECHNOLOGY", "MARKETS", "ECONOMICS", "CRYPTO", "AI"];

// 浏览器用户代理
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

// 默认超时设置 (ms)
const DEFAULT_TIMEOUT = 20000;

export async function fetchBloombergNews(): Promise<NewsItem[]> {
  console.log("开始获取Bloomberg财经/AI新闻...");

  try {
    // 尝试从API获取新闻
    const newsItems = await fetchFromApi();

    if (newsItems.length > 0) {
      console.log(`从Bloomberg API获取到 ${newsItems.length} 篇新闻`);
      logNewsItems(newsItems);
      return newsItems;
    }

    // 如果API调用失败，返回空数组
    console.log("从Bloomberg API获取失败，返回空数组");
    return [];
  } catch (error) {
    console.error("Bloomberg抓取器发生错误:", (error as Error).message);
    return [];
  }
}

// 从Bloomberg API获取新闻
async function fetchFromApi(): Promise<NewsItem[]> {
  try {
    // 构建查询参数
    const params = {
      source: "latest_stories",
      categories: CATEGORIES,
      limit: 20, // 获取最多20条新闻
    };

    console.log(`向Bloomberg API发送请求，参数:`, params);

    const response = await axios.get(BLOOMBERG_API_URL, {
      params,
      timeout: DEFAULT_TIMEOUT,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.bloomberg.com/",
      },
    });

    if (!response.data || !Array.isArray(response.data)) {
      console.warn("从Bloomberg API获取的响应格式无效");
      return [];
    }

    const now = new Date();
    const threeHoursAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);

    // 筛选并转换为NewsItem格式
    let newsItems = response.data
      .filter((item: any) => {
        // 检查是否是付费文章
        if (item.isPremium === true || item.isPaywalled === true) return false;

        // 检查标题和摘要中是否含有付费指示词
        const text = `${item.title || ""} ${item.abstract || ""} ${
          item.byline || ""
        }`;
        if (/premium|subscribe|membership|paywall|付费|订阅|会员/i.test(text))
          return false;

        // 检查发布时间
        try {
          if (item.publishedAt) {
            const pubDate = new Date(item.publishedAt);
            return (
              !isNaN(pubDate.getTime()) &&
              pubDate >= threeHoursAgo &&
              pubDate <= now
            );
          }
        } catch (e) {
          // 忽略日期解析错误
        }

        return true;
      })
      .map((item: any) => ({
        title: item.title || "",
        content:
          item.abstract ||
          item.description ||
          `Latest news from Bloomberg: ${item.title}`,
        source: "Bloomberg",
        publishedAt: item.publishedAt
          ? new Date(item.publishedAt).toISOString()
          : now.toISOString(),
        url: item.url
          ? item.url.startsWith("http")
            ? item.url
            : `https://www.bloomberg.com${item.url}`
          : "",
        category: item.primaryCategory || "金融/市场",
        tags: ["Bloomberg"].concat(item.keywords || []),
      }));

    // 筛选出有效的新闻项（标题和URL必须存在）
    newsItems = newsItems.filter((item) => item.title && item.url);

    return newsItems;
  } catch (error) {
    console.error("从Bloomberg API获取新闻失败:", (error as Error).message);
    return [];
  }
}

// 辅助函数：记录新闻项目
function logNewsItems(news: NewsItem[]): void {
  news.forEach((item, idx) => {
    console.log(
      `Bloomberg news[${idx}]: publishedAt=${item.publishedAt}, title=${item.title}, url=${item.url}`
    );
  });
}
