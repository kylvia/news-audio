import { synthesizeTTS } from "./tts.js";
import fs from "fs/promises";

async function main() {
  const brief = {
    title: "测试TTS",
    brief:
      "这期节目就到这里了，欢迎访问http eco点 摸鱼吧 点top查阅最新及详细内容，我们下期再见",
    publishedAt: new Date().toISOString(),
    url: "",
    category: "test",
    source: "system",
    country: "cn",
  };
  try {
    const result = await synthesizeTTS(brief);
    console.log("TTS合成成功，音频文件路径：", result.audioPath);
    const stat = await fs.stat(result.audioPath);
    console.log("音频文件大小：", stat.size, "字节");
  } catch (err) {
    console.error("TTS合成失败：", err);
  }
}

main();
