import axios from "axios";
import { parseStringPromise } from "xml2js";
import type { NewsItem } from "../types.js";
import * as cheerio from "cheerio";
import { filterFreeNews, toNewsItem, deduplicateNews } from "../utils.js";

// TechCrunch RSS与网站URL
const TECHCRUNCH_RSS = "https://techcrunch.com/feed/";
const TECHCRUNCH_AI_URL = "https://techcrunch.com/tag/ai/";
const TECHCRUNCH_HOME_URL = "https://techcrunch.com/";

// 浏览器用户代理
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

// 默认超时设置 (ms)
const DEFAULT_TIMEOUT = 20000;

export async function fetchTechCrunchAI(): Promise<NewsItem[]> {
  console.log("开始获取TechCrunch AI新闻...");

  try {
    // 并行尝试多种获取方式
    const methods = [
      fetchFromRSS("ai"),
      fetchFromAIPage(),
      fetchFromHomepage("ai"),
    ];

    // 使用Promise.any()尝试所有方法，只要有一个成功就使用
    let newsItems: NewsItem[] = [];
    try {
      newsItems = await Promise.any(methods);
    } catch (error) {
      console.log("所有获取TechCrunch AI新闻的方法都失败");
    }

    if (newsItems.length > 0) {
      console.log(`从TechCrunch获取到 ${newsItems.length} 篇AI相关新闻`);
      logNewsItems(newsItems);
      return newsItems;
    }

    // 如果所有方法都失败，返回空数组
    console.log("从TechCrunch获取AI新闻失败，返回空数组");
    return [];
  } catch (error) {
    console.error("获取TechCrunch AI新闻失败:", (error as Error).message);
    return [];
  }
}

// 从RSS获取新闻，可选择过滤特定标签
async function fetchFromRSS(tag?: string): Promise<NewsItem[]> {
  try {
    console.log("正在尝试从RSS获取TechCrunch新闻...");
    const res = await axios.get(TECHCRUNCH_RSS, {
      timeout: DEFAULT_TIMEOUT,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/rss+xml, application/xml",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://techcrunch.com/",
      },
    });

    const xml = res.data;
    const result = await parseStringPromise(xml, { explicitArray: false });
    let entries = result.rss.channel.item || [];
    if (!Array.isArray(entries)) entries = [entries];

    // 过滤无效条目和转换为新闻项
    return processEntries(entries, tag);
  } catch (error) {
    console.warn("从TechCrunch RSS获取新闻失败:", (error as Error).message);
    return [];
  }
}

// 从AI专题页面获取新闻
async function fetchFromAIPage(): Promise<NewsItem[]> {
  try {
    console.log("正在尝试从AI专题页面获取TechCrunch新闻...");
    const res = await axios.get(TECHCRUNCH_AI_URL, {
      timeout: DEFAULT_TIMEOUT,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://techcrunch.com/",
      },
    });

    const html = res.data;
    return scrapeNewsFromHTML(html, "ai");
  } catch (error) {
    console.warn(
      "从TechCrunch AI专题页面抓取新闻失败:",
      (error as Error).message
    );
    return [];
  }
}

// 从首页获取新闻，可选择过滤特定标签
async function fetchFromHomepage(tag?: string): Promise<NewsItem[]> {
  try {
    console.log("正在尝试从首页获取TechCrunch新闻...");
    const res = await axios.get(TECHCRUNCH_HOME_URL, {
      timeout: DEFAULT_TIMEOUT,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://techcrunch.com/",
      },
    });

    const html = res.data;
    return scrapeNewsFromHTML(html, tag);
  } catch (error) {
    console.warn("从TechCrunch首页抓取新闻失败:", (error as Error).message);
    return [];
  }
}

// 从HTML中抓取新闻
function scrapeNewsFromHTML(html: string, tag?: string): NewsItem[] {
  try {
    const $ = cheerio.load(html);
    const newsItems: NewsItem[] = [];
    const now = new Date();

    // 查找文章元素 (注意选择器可能需要根据当前网站结构调整)
    $("article").each((i, el) => {
      try {
        const titleEl = $(el).find("h2, h3, .post-block__title a");
        const title = titleEl.text().trim();
        const linkEl = $(el).find("a").first();
        const url = linkEl.attr("href") || "";

        // 提取内容
        const contentEl = $(el).find("p, .post-block__content");
        const content =
          contentEl.text().trim() || `TechCrunch latest news: ${title}`;

        // 提取时间 (可能格式各异，尝试常见模式)
        let publishedAt = now.toISOString();
        const timeEl = $(el).find("time, .post-block__date");
        if (timeEl.length) {
          const dateStr = timeEl.attr("datetime") || timeEl.text().trim();
          try {
            if (dateStr) {
              publishedAt = new Date(dateStr).toISOString();
            }
          } catch (e) {
            // 忽略日期解析错误
          }
        }

        // 提取标签
        const tags = ["TechCrunch"];
        $(el)
          .find(".tag-link, .article__tag")
          .each((_, tagEl) => {
            tags.push($(tagEl).text().trim());
          });

        // 如果指定了标签过滤，检查是否匹配
        const tagsText = tags.join(" ").toLowerCase();
        const titleAndContent = (title + " " + content).toLowerCase();

        if (tag) {
          // 检查标签、标题和内容中是否包含过滤词
          if (
            !tagsText.includes(tag.toLowerCase()) &&
            !titleAndContent.includes(tag.toLowerCase())
          ) {
            return; // 跳过此项目
          }
        }

        if (title && url) {
          const newsItem: NewsItem = {
            title,
            content,
            source: "TechCrunch",
            publishedAt,
            url,
            category: tag ? `科技/${tag.toUpperCase()}` : "科技",
            tags,
          };

          newsItems.push(newsItem);
        }
      } catch (error) {
        console.warn("解析TechCrunch新闻项出错:", (error as Error).message);
      }
    });

    // 过滤和处理新闻项
    return filterNewsItems(newsItems);
  } catch (error) {
    console.warn("解析TechCrunch HTML失败:", (error as Error).message);
    return [];
  }
}

// 处理RSS条目
function processEntries(entries: any[], tag?: string): NewsItem[] {
  if (!entries || !entries.length) return [];

  // 检查 published 字段是否可解析为有效时间
  const validEntries = entries.filter(
    (entry) => !isNaN(Date.parse(entry.pubDate))
  );

  if (validEntries.length === 0) {
    console.warn("TechCrunch: 所有条目的pubDate字段无法解析为有效时间");
    return [];
  }

  // 只保留3小时内的新闻
  const now = new Date();
  const threeHoursAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);

  let newsItems = validEntries
    .filter((entry) => {
      const pubDate = new Date(entry.pubDate);
      if (
        isNaN(pubDate.getTime()) ||
        pubDate < threeHoursAgo ||
        pubDate > now
      ) {
        return false;
      }

      // 如果指定了标签过滤，检查是否匹配
      if (tag) {
        const categories = entry.category;
        // 处理多种可能的类别格式
        let categoryArray: string[] = [];
        if (Array.isArray(categories)) {
          categoryArray = categories;
        } else if (typeof categories === "string") {
          categoryArray = [categories];
        }

        // 将类别文本及标题内容转为小写进行比较
        const categoryText = categoryArray.join(" ").toLowerCase();
        const titleAndContent = `${entry.title || ""} ${
          entry.description || ""
        }`.toLowerCase();

        // 如果在类别或内容中找不到指定标签，跳过
        if (
          !categoryText.includes(tag.toLowerCase()) &&
          !titleAndContent.includes(tag.toLowerCase())
        ) {
          return false;
        }
      }

      return true;
    })
    .map((entry) =>
      toNewsItem(entry, {
        source: "TechCrunch",
        category: tag ? `科技/${tag.toUpperCase()}` : "科技",
        tags: ["TechCrunch"],
        titleField: "title",
        contentField: "description",
        publishedAtField: "pubDate",
        urlField: "link",
      })
    );

  // 应用其他过滤器
  return filterNewsItems(newsItems);
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
      `TechCrunch news[${idx}]: publishedAt=${item.publishedAt}, title=${item.title}, url=${item.url}`
    );
  });
}
