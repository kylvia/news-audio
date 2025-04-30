import { cleanupOSSBriefsByBriefsJson } from "./oss.js";

async function testCleanup() {
  console.log("\n=== 开始测试 OSS 清理功能 ===\n");
  
  try {
    // 测试清理 7 天前的数据
    await cleanupOSSBriefsByBriefsJson(7);
    console.log("\n=== 测试完成 ===\n");
  } catch (err) {
    console.error("\n=== 测试失败 ===", err);
  }
}

testCleanup();
