export interface NewsItem {
  title: string;
  content: string;
  source: string;
  publishedAt: string; // ISO8601
  url: string;
  category: string;
  tags?: string[];
}

export interface StoryBrief {
  title: string;
  brief: string; // 口语化故事简报正文
  source: string;
  publishedAt: string;
  url: string;
  category: string;
  tags?: string[];
}

export interface TTSResult {
  briefId: string;
  audioPath: any; // 本地临时mp3路径
}
