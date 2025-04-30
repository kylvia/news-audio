// 全局 ReadableStream polyfill
// 这个文件需要在应用启动时最早加载

try {
  // 尝试从 stream/web 模块加载 ReadableStream
  const streamWeb = require('stream/web');
  
  if (typeof globalThis.ReadableStream === 'undefined') {
    globalThis.ReadableStream = streamWeb.ReadableStream;
    console.log('[Polyfill] 已添加 ReadableStream 全局对象');
  }
} catch (error) {
  try {
    // 备选方案：尝试从 undici 模块加载 ReadableStream
    const { ReadableStream } = require('undici');
    
    if (typeof globalThis.ReadableStream === 'undefined') {
      globalThis.ReadableStream = ReadableStream;
      console.log('[Polyfill] 已从 undici 添加 ReadableStream 全局对象');
    }
  } catch (undiciError) {
    console.error('[Polyfill] 无法加载 ReadableStream:', error.message);
    console.error('[Polyfill] 备选方案也失败:', undiciError.message);
  }
}
