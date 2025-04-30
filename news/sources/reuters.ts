// // 此文件保留用于兼容，如需 Reuters 新闻请直接调用 fetchAllNewsFromNewsAPI
// export {};

// import { parseStringPromise } from "xml2js";
// import type { NewsItem } from "../types.js";
// import * as cheerio from "cheerio";
// import { filterFreeNews, toNewsItem, deduplicateNews } from "../utils.js";

// // Reuters RSS与网站URL
// const REUTERS_RSS =
//   "https://www.reutersagency.com/feed/?best-topics=business-finance";
// const BACKUP_RSS_URLS = [
//   "https://www.reutersagency.com/feed/?taxonomy=best-topics&post_type=best",
//   "https://www.reutersagency.com/feed/?taxonomy=best-sectors&post_type=best",
//   "https://www.reutersagency.com/feed/?best-topic=business-finance",
// ];
// const REUTERS_MARKETS_URL = "https://www.reuters.com/markets";
// const REUTERS_BUSINESS_URL = "https://www.reuters.com/business";
// const REUTERS_TECH_URL = "https://www.reuters.com/technology";

// // 浏览器用户代理
// const USER_AGENT =
//   "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

// // 默认超时设置 (ms)
// const DEFAULT_TIMEOUT = 20000;

// // 从主要RSS获取新闻
// async function fetchFromMainRSS(): Promise<NewsItem[]> {
//   try {
//     console.log("正在尝试从主要RSS获取Reuters新闻...");
//     const res = await axios.get(REUTERS_RSS, {
//       timeout: DEFAULT_TIMEOUT,
//       headers: {
//         "User-Agent": USER_AGENT,
//         Accept: "application/rss+xml, application/xml",
//         "Accept-Language": "en-US,en;q=0.9",
//         Referer: "https://www.reuters.com/",
//       },
//     });

//     const xml = res.data;
//     const result = await parseStringPromise(xml, { explicitArray: false });
//     let entries = result.rss.channel.item || [];
//     if (!Array.isArray(entries)) entries = [entries];

//     // 过滤无效条目和转换为新闻项
//     return processEntries(entries);
//   } catch (error) {
//     console.warn("从Reuters主要RSS获取新闻失败:", (error as Error).message);
//     return [];
//   }
// }

// // 从备用RSS获取新闻
// async function fetchFromBackupRSS(): Promise<NewsItem[]> {
//   console.log("正在尝试从备用RSS源获取Reuters新闻...");
//   const failedUrls: string[] = [];

//   // 尝试所有备用RSS源
//   for (const url of BACKUP_RSS_URLS) {
//     try {
//       const res = await axios.get(url, {
//         timeout: DEFAULT_TIMEOUT,
//         headers: {
//           "User-Agent": USER_AGENT,
//           Accept: "application/rss+xml, application/xml",
//           "Accept-Language": "en-US,en;q=0.9",
//           Referer: "https://www.reuters.com/",
//         },
//       });

//       const xml = res.data;
//       const result = await parseStringPromise(xml, { explicitArray: false });
//       let entries = result.rss.channel.item || [];
//       if (!Array.isArray(entries)) entries = [entries];

//       // 过滤无效条目和转换为新闻项
//       const newsItems = processEntries(entries);
//       if (newsItems.length > 0) {
//         return newsItems;
//       }
//     } catch (error) {
//       failedUrls.push(url);
//       console.warn(`备用RSS源 ${url} 失败:`, (error as Error).message);
//     }
//   }

//   if (failedUrls.length === BACKUP_RSS_URLS.length) {
//     console.warn("从Reuters备用RSS获取新闻失败: 所有备用RSS源都失败");
//   }

//   return [];
// }

// // 从网站直接抓取新闻
// async function fetchFromWebsite(): Promise<NewsItem[]> {
//   console.log("正在尝试从网站直接抓取Reuters新闻...");
//   const urls = [REUTERS_MARKETS_URL, REUTERS_BUSINESS_URL, REUTERS_TECH_URL];
//   const allNewsItems: NewsItem[] = [];

//   // 尝试从多个网页抓取新闻
//   for (const url of urls) {
//     try {
//       const res = await axios.get(url, {
//         timeout: DEFAULT_TIMEOUT,
//         headers: {
//           "User-Agent": USER_AGENT,
//           Accept: "text/html,application/xhtml+xml",
//           "Accept-Language": "en-US,en;q=0.9",
//           Referer: "https://www.reuters.com/",
//         },
//       });

//       const html = res.data;
//       const $ = cheerio.load(html);
//       const now = new Date();

//       // 查找新闻元素 (注: 选择器可能需要根据当前网站结构调整)
//       $("article").each((i, el) => {
//         try {
//           const titleEl = $(el).find("h3");
//           const title = titleEl.text().trim();
//           const linkEl = $(el).find("a").first();
//           const path = linkEl.attr("href") || "";
//           const url = path.startsWith("http")
//             ? path
//             : `https://www.reuters.com${path}`;
//           const content = $(el).find("p").text().trim();

//           if (title && url) {
//             const newsItem: NewsItem = {
//               title,
//               content: content || `Reuters最新财经新闻: ${title}`,
//               source: "Reuters Business",
//               publishedAt: now.toISOString(),
//               url,
//               category: "财经/商业",
//               tags: ["Reuters", "Business"],
//             };

//             allNewsItems.push(newsItem);
//           }
//         } catch (error) {
//           console.warn("解析Reuters新闻项出错:", (error as Error).message);
//         }
//       });

//       console.log(`从 ${url} 抓取到 ${allNewsItems.length} 条新闻`);
//     } catch (error) {
//       console.warn(`从 ${url} 抓取失败:`, (error as Error).message);
//     }
//   }

//   // 过滤并处理新闻项
//   return filterNewsItems(allNewsItems);
// }

// // 处理RSS条目
// function processEntries(entries: any[]): NewsItem[] {
//   if (!entries || !entries.length) return [];

//   // 检查 published 字段是否可解析为有效时间
//   const validEntries = entries.filter(
//     (entry) => !isNaN(Date.parse(entry.pubDate))
//   );

//   if (validEntries.length === 0) {
//     console.warn("Reuters: 所有条目的pubDate字段无法解析为有效时间");
//     // 尝试使用前两条，不考虑日期
//     return entries.slice(0, 2).map((entry) =>
//       toNewsItem(entry, {
//         source: "Reuters Business",
//         category: "财经/商业",
//         tags: ["Reuters"],
//         titleField: "title",
//         contentField: "description",
//         publishedAtField: "pubDate",
//         urlField: "link",
//       })
//     );
//   }

//   // 只保留3小时内的新闻
//   const now = new Date();
//   const threeHoursAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);

//   return validEntries
//     .filter((entry) => {
//       const pubDate = new Date(entry.pubDate);
//       return (
//         !isNaN(pubDate.getTime()) && pubDate >= threeHoursAgo && pubDate <= now
//       );
//     })
//     .map((entry) =>
//       toNewsItem(entry, {
//         source: "Reuters Business",
//         category: "财经/商业",
//         tags: ["Reuters"],
//         titleField: "title",
//         contentField: "description",
//         publishedAtField: "pubDate",
//         urlField: "link",
//       })
//     );
// }

// // 过滤新闻项
// function filterNewsItems(newsItems: NewsItem[]): NewsItem[] {
//   if (!newsItems || !newsItems.length) return [];

//   // 过滤3小时内的内容
//   const now = new Date();
//   const threeHoursAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);

//   let filteredItems = newsItems.filter((item) => {
//     try {
//       const pubDate = new Date(item.publishedAt);
//       return (
//         !isNaN(pubDate.getTime()) && pubDate >= threeHoursAgo && pubDate <= now
//       );
//     } catch (e) {
//       return true; // 如果日期解析失败，默认保留
//     }
//   });

//   // 应用其他过滤器
//   filteredItems = filterFreeNews(filteredItems);
//   filteredItems = deduplicateNews(filteredItems);

//   // 限制为最多3条
//   return filteredItems.slice(0, 3);
// }

// // 辅助函数：记录新闻项目
// function logNewsItems(news: NewsItem[]): void {
//   news.forEach((item, idx) => {
//     console.log(
//       `Reuters Business news[${idx}]: publishedAt=${item.publishedAt}, title=${item.title}, url=${item.url}`
//     );
//   });
// }
