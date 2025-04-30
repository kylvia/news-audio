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
  const { title, content, ...rest } = news;
  // const prompt = `请将以下新闻内容改写为口语化、适合听播的简报，突出重点，最多500字。\n不要出现“以上就是今天的科技简报，我们下次再见！”、“大家好，今天给大家带来一条科技创投圈的新消息。”等开头或收尾语。直接进入新闻本身内容。\n标题：${title}\n内容：${content}`;
  const prompt = `请将以下新闻文章转换为播客简报文案。\n
    要求：\n
    1. 使用适合口语播报的语言风格，简洁明快\n
    2. 将复杂概念简化为易于理解的表达\n
    3. 保留文章的核心信息和关键数据点\n
    4. 不要添加标准的开场白、结束语或明显的转场提示\n
    5. 直接进入主题，专注于内容本身\n
    6. 最多500字\n
    7. 按原文的逻辑顺序组织内容，但以更适合口头表达的方式重新构建。\n
    8. 不要出现“以上就是今天的科技简报，我们下次再见！”、“大家好，今天给大家带来一条科技创投圈的新消息。”等开头或收尾语。\n标题：${title}\n内容：${content}。`;
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
      max_tokens: 550,
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
    ...rest,
    title,
    brief,
  };
}
