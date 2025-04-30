export interface BriefItem {
  title: string;
  brief: string;
  source: string;
  publishedAt: string;
  url: string;
  category: string;
  tags?: string[];
  audioUrl: string;
  _globalIdx?: number;
}
