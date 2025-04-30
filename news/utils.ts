// 统一过滤免费内容工具
export function filterFreeNews(entries: any[]): any[] {
  // 付费内容关键词检测
  const FREE_KEYWORDS = /订阅|会员|付费|Premium|Subscribe|Members[- ]Only|Paywall|收费|收费阅读/i;
  
  // 付费内容URL路径检测
  const PAID_URL_PATTERNS = [
    /\/member\//i,          // 通用会员路径
    /\/premium\//i,         // 通用高级会员路径
    /\/subscription\//i,    // 订阅内容路径
    /\/paywall\//i,         // 付费墙内容路径
    /wallstreetcn\.com\/member\//i // 华尔街见闻会员专区
  ];
  
  return entries.filter(entry => {
    // 检查标题、内容中的付费关键词
    const textContent = (entry.title || "") + 
                        (entry.description || "") + 
                        (entry.summary || "") + 
                        (entry.content || "");
    
    if (FREE_KEYWORDS.test(textContent)) {
      return false;
    }
    
    // 检查URL中的付费路径
    if (entry.url) {
      for (const pattern of PAID_URL_PATTERNS) {
        if (pattern.test(entry.url)) {
          return false;
        }
      }
    }
    
    return true;
  });
}

// 全局标准化去重工具
export function deduplicateNews(news: any[], keyFn: (item: any) => string = (item) => item.url || (item.title + item.publishedAt)): any[] {
  const seen = new Set();
  return news.filter(item => {
    const key = keyFn(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// 标准化新闻条目
export function toNewsItem(entry: any, options: {
  source: string,
  category: string,
  tags: string[],
  titleField?: string,
  contentField?: string,
  publishedAtField?: string,
  urlField?: string,
}): any {
  return {
    title: (entry[options.titleField || 'title'] || '').trim(),
    content: (entry[options.contentField || 'description'] || '').trim(),
    source: options.source,
    publishedAt: entry[options.publishedAtField || 'pubDate'],
    url: entry[options.urlField || 'link'],
    category: options.category,
    tags: options.tags,
  };
}

// 通用时间窗口过滤
export function filterByTimeWindow(news: any[], windowMs: number): any[] {
  const now = Date.now();
  return news.filter(item => {
    const pub = new Date(item.publishedAt).getTime();
    return !isNaN(pub) && (now - pub >= 0) && (now - pub <= windowMs);
  });
}

// 通用 entries 处理流程
export function processEntries(
  entries: any[],
  toNewsItemFn: (entry: any) => any,
  windowMs: number,
  filterFreeNews: (news: any[]) => any[],
  deduplicateFn: (news: any[]) => any[] = deduplicateNews
): any[] {
  let news = entries.map(toNewsItemFn);
  news = filterByTimeWindow(news, windowMs);
  news = filterFreeNews(news);
  news = deduplicateFn(news);
  return news;
}

// 日志输出
export function logNews(news: any[], source: string) {
  news.forEach((item, idx) => {
    console.log(`${source} news[${idx}]: publishedAt=${item.publishedAt}, title=${item.title}`);
  });
}
