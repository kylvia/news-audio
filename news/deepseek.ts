import axios from "axios";
import { NewsItem, StoryBrief } from "./types.js";

export const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
export const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
if (!DEEPSEEK_API_KEY) {
  throw new Error("DEEPSEEK_API_KEY environment variable is required");
}
/**
 * 调用 DeepSeek LLM API，将新闻内容转为故事化简报
 */
export async function generateStoryBrief(news: NewsItem): Promise<StoryBrief> {
  const prompt = `请将以下新闻内容改写为口语化、适合听播的简报，突出重点，最多500字。\n不要出现“以上就是今天的科技简报，我们下次再见！”、“大家好，今天给大家带来一条科技创投圈的新消息。”等开头或收尾语。直接进入新闻本身内容。\n标题：${news.title}\n内容：${news.content}`;
  const messages = [
    { role: "system", content: "你是专业的中文新闻播报文案助手。" },
    { role: "user", content: prompt },
  ];

  const res = await axios.post(
    DEEPSEEK_API_URL,
    {
      model: "deepseek-chat",
      messages,
      temperature: 0.7,
      max_tokens: 500,
    },
    {
      headers: {
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  const brief = res.data.choices?.[0]?.message?.content?.trim() || "";

  return {
    title: news.title,
    brief,
    source: news.source,
    publishedAt: news.publishedAt,
    url: news.url,
    category: news.category,
    tags: news.tags,
  };
}
