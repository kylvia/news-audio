import { generateStoryBrief } from "./deepseek.js";
import { NewsItem } from "./types.js";

// 测试数据
const testNews: NewsItem = {
  title:
    "Warren Buffett at the Berkshire Hathaway annual meeting 2025: Live updates",
  content:
    'When asked about artificial intelligence\'s ability to transform the insurance industry, Ajit Jain admitted that the technology could be a "real game changer" in the way the business currently assesses, prices, and sells risk; and how it currently pays claims.\nBut Jain said that Berkshire is taking a more hesitant approach when it comes to any lofty new technological claims.\n"I certainly also feel that people end up spending enormous amounts of money trying to chase the next new fashionable thing," he said. "We are not very good in terms of being the fastest or the first mover. Our approach is more to wait and see until the opportunity crystallizes, and we have a better point of view in terms of risk of failure, upside, downside."\nHowever, Jain added that Berkshire wouldn\'t hesitate to invest once the right opportunity does arise.\n"Right now, the individual insurance operations do dabble in AI and try and figure out what is the best way to exploit it, but we have not yet made a conscious big-time effort in terms of pouring a lot of money into this opportunity," he added. "My guess is we will be in a state of readiness and should that opportunity pop up, we\'ll be in a state where we\'ll jump in promptly.\n— Lisa Kailai Han',
  url: "https://www.cnbc.com/2025/05/03/warren-buffett-at-the-berkshire-hathaway-annual-meeting-2025-live-updates.html",
  publishedAt: "2025-05-03T14:14:00Z",
  source: "科技日报",
  category: "technology",
  country: "cn",
};

// 测试函数
async function testDeepseek() {
  console.log("开始测试 generateStoryBrief 方法...");
  console.log("输入新闻:", testNews);

  try {
    console.log("正在调用 DeepSeek API...");
    const result = await generateStoryBrief(testNews);
    console.log("API调用成功!");
    console.log("生成的简报:");
    console.log("-------------------");
    console.log(result.brief);
    console.log("-------------------");
    console.log("简报字数:", result.brief.length);
  } catch (error) {
    console.error("测试失败:", error);
    if (error.response) {
      console.error("API响应:", error.response.data);
    }
  }
}

// 运行测试
testDeepseek().catch(console.error);
