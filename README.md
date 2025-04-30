# News Audio# 摸鱼经济学 - AI新闻音频简报系统

一个利用 AI 技术自动将新闻转换为音频简报的系统。用户可以在通勤、运动等碎片时间里通过音频了解最新新闻。项目利用gnews.io API获取新闻，DeepSeek生成简报，MinimaxTTS转换语音，内容存储于阿里云OSS并通过网站和小宇宙分发。从爬虫到API，从百度TTS到Minimax，历经多次技术迭代，最终打造出一个让用户能在碎片时间轻松获取财经资讯的自动化平台。项目已经上线，网站地址是http://eco.moyuba.top，同时内容也在小宇宙平台进行音频分发，播客地址是 https://www.xiaoyuzhoufm.com/podcast/680b50ea1168df730183ae30

## 功能特点

- **AI新闻生成**
  - 使用 DeepSeek API 生成高质量的新闻简报
  - 支持多语言新闻源（中文、英文）
  - 自动去重和内容优化

- **音频生成**
  - 使用阿里云 TTS 服务生成自然流畅的语音
  - 自动合并多个新闻简报为单个音频文件
  - 支持自定义开头和结尾语音

- **Web界面**
  - 响应式设计，适配各种设备
  - 支持播放、暂停、快进、快退
  - 支持分享和下载

- **定时任务**
  - 每两小时自动抓取新闻
  - 每天凌晨2点生成每日介绍音频
  - 每天凌晨3点清理过期数据

## 技术栈

- **后端**
  - Node.js + TypeScript
  - 阿里云 OSS 存储
  - PM2 进程管理
  - Nginx 反向代理

- **前端**
  - React + TypeScript
  - Vite 构建工具
  - Tailwind CSS 样式

## 环境变量

请参考 .env.example 文件中的环境变量配置。

## 使用方法

### 后端

1. 安装依赖
```bash
npm install
```

2. 编译代码
```bash
npm run build
```

3. 拉取新闻到输出音频上传OSS
```bash
npm run demo:brief
```

### 前端

1. 进入前端目录
```bash
cd frontend
```

2. 安装依赖
```bash
npm install
```

3. 开发模式
```bash
npm run dev
```

4. 构建生产版本
```bash
npm run build
```

## 部署

```bash
# 本地编译
npm run build

# 构建前端
cd frontend
npm run build

# 部署
# 需要修改 deploy.sh.example 中的配置到 deploy.sh
./deploy.sh
```

## 测试

### 音频测试

```bash
npx ts-node-esm news/tts_test.ts
```
### 简报合成测试

```bash
cd ./python_tools 
source venv/bin/activate
python merge_mp3_briefs.py --hours 10
```

## 注意事项

- 确保所有环境变量已正确配置
- 定期检查 OSS 存储空间
- 监控 API 调用频率限制
- 保持系统时间同步