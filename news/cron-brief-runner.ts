// 确保 ReadableStream 在全局范围内可用
try {
  if (typeof globalThis.ReadableStream === "undefined") {
    // @ts-ignore
    globalThis.ReadableStream = require("stream/web").ReadableStream;
    console.log("[Polyfill] 已添加 ReadableStream 全局对象");
  }
} catch (error) {
  console.error("[Polyfill] 无法加载 ReadableStream:", error);
}

import cron from "node-cron";
import { main } from "./demo-brief-runner.js";
import { synthesizeTTS } from "./tts.js";
import { uploadAudioToOSS, cleanupOSSBriefsByBriefsJson } from "./oss.js";
import path from "path";

// 服务器本地时间已经是北京时间，无需再加8小时
function getBeijingTime() {
  return new Date();
}

async function runDailyIntroTask(tag: string) {
  try {
    const now = getBeijingTime();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const weekdayIndex = now.getDay();
    const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
    const weekday = weekdays[weekdayIndex];
    const introText = `今天是北京时间${year}年${month}月${day}日星期${weekday}，欢迎收听今天的摸鱼经济学`;
    console.log(`[${tag}] 生成介绍文本: ${introText}`);
    const ttsResult = await synthesizeTTS({
      title: "每日介绍",
      brief: introText,
      publishedAt: now.toISOString(),
      url: "",
      category: "intro",
      source: "system",
      country: "cn",
    });
    const dateStr = `${year}${month.toString().padStart(2, "0")}${day
      .toString()
      .padStart(2, "0")}`;
    const objectName = `daily-intro-${dateStr}.mp3`;
    const ossUrl = await uploadAudioToOSS(ttsResult.audioPath, objectName);
    console.log(`[${tag}] 每日介绍音频已上传: ${ossUrl}`);
    console.log(`[${tag}] 每日介绍音频处理完成: ${new Date().toISOString()}`);
  } catch (err) {
    console.error(`[${tag}] 每日介绍音频生成异常:`, err);
  }
}

// 启动服务时立即执行一次主定时任务和每日介绍音频任务
// (async () => {
//   try {
//     console.log(`[启动任务] 立即抓取新闻: ${new Date().toISOString()}`);
//     await main();
//     console.log(
//       `[启动任务] 启动时新闻简报处理完成: ${new Date().toISOString()}`
//     );
//   } catch (err) {
//     console.error("[启动任务] 启动流程异常:", err);
//   }
//   await runDailyIntroTask("启动任务");
// })();

// 每两小时自动抓取、生成、上传新闻简报
cron.schedule("0 */2 * * *", async () => {
  try {
    console.log(`[定时任务] 开始自动抓取新闻: ${new Date().toISOString()}`);
    await main();
    console.log(`[定时任务] 本轮新闻简报处理完成: ${new Date().toISOString()}`);
  } catch (err) {
    console.error("[定时任务] 自动化流程异常:", err);
  }
});

// 每天凌晨2点生成并上传日期介绍音频
cron.schedule("0 2 * * *", async () => {
  await runDailyIntroTask("定时任务");
});

console.log("新闻简报定时任务已启动，每两小时自动执行一次。");
console.log("每日介绍音频定时任务已启动，每天凌晨2点执行一次。");

// 每天凌晨3点自动清理 OSS 7天前的简报数据
cron.schedule("0 3 * * *", async () => {
  try {
    console.log(`[定时任务] 开始清理 OSS 7天前数据: ${new Date().toISOString()}`);
    await cleanupOSSBriefsByBriefsJson(7);
    console.log(`[定时任务] OSS 过期数据清理完成: ${new Date().toISOString()}`);
  } catch (err) {
    console.error("[定时任务] OSS 清理异常:", err);
  }
});

console.log("OSS 过期数据清理定时任务已启动，每天凌晨3点执行一次。");;
