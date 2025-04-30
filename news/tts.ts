import axios from "axios";
import fs from "fs/promises";
import path from "path";
import type { StoryBrief, TTSResult } from "./types.js";

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY!;
const MINIMAX_GROUP_ID = process.env.MINIMAX_GROUP_ID || undefined; // 如控制台要求
const MINIMAX_TTS_URL = `https://api.minimax.chat/v1/t2a_v2?GroupId=${MINIMAX_GROUP_ID}`;
const TMP_DIR = path.resolve("tmp/tts");

function safeText(text: string, maxLen = 512): string {
  // 只保留中英文、数字、常见标点
  const filtered = text.replace(
    /[^\u0000-\u007f\u4e00-\u9fa5a-zA-Z0-9，。！？、；：“”‘’（）()《》〈〉,.!?;:'\"()<>\s-]/g,
    ""
  );
  // 截断最大长度（按字符，不是字节）
  return filtered.length > maxLen ? filtered.slice(0, maxLen) : filtered;
}

export async function synthesizeTTS(brief: StoryBrief): Promise<TTSResult> {
  await fs.mkdir(TMP_DIR, { recursive: true });
  const briefId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const filePath = path.join(TMP_DIR, `${briefId}.mp3`);

  // 使用安全文本处理
  const text = safeText(brief.brief, 512);

  // MiniMax T2A V2参数，按需补充 group_id、model、sample_rate
  const payload: any = {
    model: "speech-02-turbo",
    text: text,
    timber_weights: [
      {
        voice_id: "Boyan_new_platform",
        weight: 100,
      },
    ],
    voice_setting: {
      voice_id: "",
      speed: 1.03,
      pitch: 0,
      vol: 7,
      emotion: "neutral",
      latex_read: false,
    },
    audio_setting: {
      sample_rate: 32000,
      bitrate: 128000,
      format: "mp3",
    },
    language_boost: "auto",
  };
  const res = await axios.post(MINIMAX_TTS_URL, payload, {
    headers: {
      Authorization: `Bearer ${MINIMAX_API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (res?.data?.data?.audio) {
    const audioBuffer = Buffer.from(res.data.data.audio, "hex");
    await fs.writeFile(filePath, audioBuffer);
    return { briefId, audioPath: filePath };
  } else {
    throw new Error("MiniMax TTS生成失败: ");
  }
}

// 并发批量合成
export async function synthesizeTTSBatch(
  briefs: StoryBrief[],
  concurrency = 3
): Promise<TTSResult[]> {
  const results: TTSResult[] = [];
  let idx = 0;
  let running: {
    p: Promise<{ i: number; value: TTSResult | undefined }>;
    i: number;
  }[] = [];

  async function run(i: number) {
    try {
      const value = await synthesizeTTS(briefs[i]);
      return { i, value };
    } catch (e) {
      console.error(`[TTS] 合成失败: ${briefs[i].title}`, e);
      return { i, value: undefined };
    }
  }

  while (idx < briefs.length) {
    if (running.length < concurrency) {
      const p = run(idx);
      running.push({ p, i: idx });
      idx++;
    } else {
      const settled = await Promise.race(running.map((r) => r.p));
      const settleIdx = running.findIndex((r) => r.i === settled.i);
      if (settleIdx !== -1) running.splice(settleIdx, 1);
      results[settled.i] = settled.value;
    }
  }
  const settledAll = await Promise.all(running.map((r) => r.p));
  for (const s of settledAll) {
    if (s) results[s.i] = s.value;
  }
  return results;
}
