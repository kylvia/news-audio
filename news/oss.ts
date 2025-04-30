import "dotenv/config";
import OSS from "ali-oss";
import fs from "fs/promises";
import path from "path";

const endpoint = process.env.OSS_ENDPOINT; // 优先用 endpoint
const region = process.env.OSS_REGION;
const accessKeyId = process.env.OSS_ACCESS_KEY_ID;
const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;
const audioBucket = process.env.OSS_AUDIO_BUCKET;
const textBucket = process.env.OSS_TEXT_BUCKET;

export const ossAudioClient = new OSS({
  ...(endpoint ? { endpoint } : { region }),
  accessKeyId,
  accessKeySecret,
  bucket: audioBucket,
});

export const ossTextClient = new OSS({
  ...(endpoint ? { endpoint } : { region }),
  accessKeyId,
  accessKeySecret,
  bucket: textBucket,
});

export async function uploadAudioToOSS(
  localPath: string,
  objectName?: string
): Promise<string> {
  const fileName = objectName || path.basename(localPath);
  const res = await ossAudioClient.put(fileName, localPath);
  return res.url;
}

export async function uploadTextToOSS(
  content: string,
  objectName: string
): Promise<string> {
  const tmpPath = path.join("/tmp", objectName);
  await fs.writeFile(tmpPath, content, "utf-8");
  const res = await ossTextClient.put(objectName, tmpPath);
  await fs.unlink(tmpPath);
  await clearTmpDir("/tmp");
  return res.url;
}

// 彻底清空 /tmp 目录（递归删除所有文件和子目录）
async function clearTmpDir(tmpDir: string = "/tmp") {
  try {
    const files = await fs.readdir(tmpDir);
    for (const file of files) {
      const filePath = path.join(tmpDir, file);
      try {
        const stat = await fs.stat(filePath);
        if (stat.isDirectory()) {
          await clearTmpDir(filePath);
          await fs.rmdir(filePath);
        } else {
          await fs.unlink(filePath);
        }
      } catch (err) {
        // 忽略单个文件错误
      }
    }
  } catch (err) {
    // 忽略目录不存在
  }
}

// 清理 /tmp 目录，仅保留最近2天的数据
async function cleanupTmpDir(tmpDir: string = "/tmp") {
  try {
    const files = await fs.readdir(tmpDir);
    const now = Date.now();
    const expireMs = 2 * 24 * 60 * 60 * 1000; // 2天
    for (const file of files) {
      const filePath = path.join(tmpDir, file);
      try {
        const stat = await fs.stat(filePath);
        if (stat.isFile() && now - stat.mtimeMs > expireMs) {
          await fs.unlink(filePath);
          console.log(`[清理] 已删除过期临时文件: ${filePath}`);
        }
      } catch (err) {
        // 忽略单个文件错误
      }
    }
  } catch (err) {
    // 忽略目录不存在
  }
}

// 清理 OSS 中的过期简报数据
export async function cleanupOSSBriefsByBriefsJson(days: number = 7) {
  const now = new Date();
  const expireDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  console.log(
    `[OSS清理] 开始清理 ${days} 天前的数据，截止日期: ${expireDate.toISOString()}`
  );

  try {
    // 1. 从 OSS 下载 briefs.json
    const briefsRes = await ossTextClient.get("briefs.json");
    const briefs = JSON.parse(briefsRes.content.toString());
    console.log(`[OSS清理] 从 briefs.json 读取到 ${briefs.length} 条简报数据`);

    // 2. 筛选出过期的简报
    const expiredBriefs = briefs.filter((brief) => {
      const publishedAt = new Date(brief.publishedAt);
      return publishedAt < expireDate;
    });
    console.log(`[OSS清理] 发现 ${expiredBriefs.length} 条过期简报`);

    if (expiredBriefs.length === 0) {
      console.log("[OSS清理] 没有找到需要清理的过期数据");
      return;
    }

    // 3. 收集所有需要删除的 OSS 对象名
    const toDelete = new Set<string>();
    for (const brief of expiredBriefs) {
      // 收集音频文件
      if (brief.audioUrl) {
        // 从 audioUrl 中提取 OSS 路径（假设是 OSS bucket 的相对路径）
        const audioPath = brief.audioUrl.split("/").pop();
        if (audioPath) {
          toDelete.add(audioPath);
        }
      }
      // 收集单条简报 json
      if (brief.detailPath) {
        toDelete.add(brief.detailPath);
      }
    }
    console.log(`[OSS清理] 需要删除 ${toDelete.size} 个 OSS 对象`);

    // 4. 删除 OSS 对象
    const clients = [ossAudioClient, ossTextClient];
    for (const objName of toDelete) {
      try {
        // 尝试在两个 bucket 中都删除（因为有的文件可能在 audio bucket，有的在 text bucket）
        for (const client of clients) {
          try {
            await client.delete(objName);
            console.log(`[OSS清理] 已删除对象: ${objName}`);
            break; // 成功删除后跳出
          } catch (err) {
            if (err.code === "NoSuchKey") {
              continue; // 文件不存在，继续尝试下一个 bucket
            }
            throw err; // 其他错误抛出
          }
        }
      } catch (err) {
        console.error(`[OSS清理] 删除对象失败: ${objName}`, err);
      }
    }

    // 5. 更新 briefs.json，只保留未过期的条目
    const newBriefs = briefs.filter((brief) => !expiredBriefs.includes(brief));
    console.log(
      `[OSS清理] 更新后的 briefs.json 包含 ${newBriefs.length} 条简报`
    );

    // 6. 上传新的 briefs.json
    const tmpPath = path.join("/tmp", "briefs.json");
    await fs.writeFile(tmpPath, JSON.stringify(newBriefs, null, 2), "utf-8");
    await ossTextClient.put("briefs.json", tmpPath);
    await fs.unlink(tmpPath);
    await clearTmpDir("/tmp");
    console.log("[OSS清理] 已更新并上传新的 briefs.json");
  } catch (err) {
    console.error("[OSS清理] 清理过程发生错误:", err);
    throw err;
  }
}

// 自动聚合 OSS 上所有简报 JSON，生成 briefs.json 汇总并上传 OSS
export async function generateAndUploadBriefsSummary() {
  const prefix = ""; // 如有子目录可填写
  const result = await ossTextClient.list({ prefix });
  const jsonFiles =
    result.objects?.filter(
      (obj) => obj.name.endsWith(".json") && obj.name !== "briefs.json"
    ) || [];
  const briefs: any[] = [];
  const briefContents: string[] = [];

  function isSimilar(contentA: string, contentB: string): boolean {
    // 简单相似度判定：内容包含或Jaccard相似度>0.8
    if (!contentA || !contentB) return false;
    if (contentA.includes(contentB) || contentB.includes(contentA)) return true;
    // Jaccard 相似度
    const setA = new Set(contentA.split(/\s+/));
    const setB = new Set(contentB.split(/\s+/));
    const intersection = new Set([...setA].filter((x) => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    const similarity = intersection.size / union.size;
    return similarity > 0.8;
  }

  for (const obj of jsonFiles) {
    const res = await ossTextClient.get(obj.name);
    const brief = JSON.parse(res.content.toString());
    // 校验内容相似性
    const isDuplicate = briefContents.some((existing) =>
      isSimilar(existing, brief.brief)
    );
    if (isDuplicate) {
      console.log(`[去重] 跳过与历史内容相似的简报: ${brief.title}`);
      continue;
    }
    briefs.push({
      id: brief.id || obj.name.replace(/\.json$/, ""),
      title: brief.title,
      brief: brief.brief,
      category: brief.category,
      source: brief.source,
      publishedAt: brief.publishedAt,
      audioUrl: brief.audioUrl,
      url: brief.url,
      detailPath: obj.name,
    });
    briefContents.push(brief.brief);
  }

  // 写入本地临时文件
  const tmpPath = path.join("/tmp", "briefs.json");
  await fs.writeFile(tmpPath, JSON.stringify(briefs, null, 2), "utf-8");
  // 上传到 OSS
  await ossTextClient.put("briefs.json", tmpPath);
  await fs.unlink(tmpPath);
  await clearTmpDir("/tmp");
  console.log(`汇总 briefs.json 已上传 OSS，共${briefs.length}条`);
}

// 自动聚合 OSS 上所有简报 JSON，生成 briefs.json 汇总并上传 OSS（追加模式）
export async function generateAndUploadBriefsSummaryAppend(
  newBriefs: any[] = []
) {
  const prefix = ""; // 如有子目录可填写
  const result = await ossTextClient.list({ prefix });
  const jsonFiles =
    result.objects?.filter(
      (obj) => obj.name.endsWith(".json") && obj.name !== "briefs.json"
    ) || [];
  const briefsMap = new Map();

  // 先读取 OSS 上 briefs.json（如存在）
  let existingBriefs: any[] = [];
  try {
    const res = await ossTextClient.get("briefs.json");
    existingBriefs = JSON.parse(res.content.toString());
    for (const brief of existingBriefs) {
      // 使用 URL 或标题作为唯一键，而不是仅依赖 ID
      const uniqueKey = brief.url || brief.title;
      briefsMap.set(uniqueKey, brief);
    }
  } catch (e) {
    // briefs.json 不存在时忽略
  }

  // 再聚合 OSS 上所有单条简报 JSON
  for (const obj of jsonFiles) {
    const res = await ossTextClient.get(obj.name);
    const brief = JSON.parse(res.content.toString());
    // 使用 URL 或标题作为唯一键，而不是仅依赖 ID
    const uniqueKey = brief.url || brief.title;
    briefsMap.set(uniqueKey, {
      id: brief.id || obj.name.replace(/\.json$/, ""),
      title: brief.title,
      brief: brief.brief,
      category: brief.category,
      source: brief.source,
      publishedAt: brief.publishedAt,
      audioUrl: brief.audioUrl,
      url: brief.url,
      detailPath: obj.name,
    });
  }

  // 追加本次新抓取的简报（如有）
  for (const brief of newBriefs) {
    // 使用 URL 或标题作为唯一键，而不是仅依赖 ID
    const uniqueKey = brief.url || brief.title;
    briefsMap.set(uniqueKey, brief);
  }

  const briefs = Array.from(briefsMap.values());
  // 按发布时间倒序
  briefs.sort((a, b) =>
    (b.publishedAt || "").localeCompare(a.publishedAt || "")
  );

  // 写入本地临时文件
  const tmpPath = path.join("/tmp", "briefs.json");
  await fs.writeFile(tmpPath, JSON.stringify(briefs, null, 2), "utf-8");
  // 上传到 OSS
  await ossTextClient.put("briefs.json", tmpPath);
  await fs.unlink(tmpPath);
  await clearTmpDir("/tmp");
  console.log(`汇总 briefs.json 已追加并上传 OSS，共${briefs.length}条`);
}
