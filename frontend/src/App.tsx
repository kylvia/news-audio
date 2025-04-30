import React, { useEffect, useState, useRef } from "react";
import { BriefItem } from "./types";
import BriefList from "./components/BriefList";
import PlayerBar from "./components/PlayerBar";
import About from "./About";
const GITHUB_URL = "https://github.com/kylvia";

function App() {
  const [briefs, setBriefs] = useState<BriefItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showAbout, setShowAbout] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    fetch("https://oj-news-text-jp.oss-ap-northeast-1.aliyuncs.com/briefs.json")
      .then((res) => res.json())
      .then((data) => {
        setBriefs(
          data.map((item: any) => ({
            ...item,
            audioUrl: item.audioUrl.replace("-internal", ""),
            // publishedAt: formatDateToYYYYMMDD(item.publishedAt),
          }))
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // 自动播放下一条
  const handleEnded = () => {
    if (currentIdx < briefs.length - 1) {
      setCurrentIdx((idx) => idx + 1);
    }
  };

  // 切换播放
  const handlePlayIdx = (idx: number) => {
    setCurrentIdx(idx);
    audioRef.current?.play();
  };

  // 判断是否为今日
  function isToday(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  }

  // 按日期分组
  const todayBriefs = briefs.filter((b) => isToday(b.publishedAt));
  const otherBriefs = briefs.filter((b) => !isToday(b.publishedAt));
  const todayBriefsLen = todayBriefs?.length || 0;

  // 合并今日和往日新闻，保证 currentIdx 全局唯一
  const allBriefs = [...todayBriefs, ...otherBriefs];

  function formatDateToYYYYMMDD(dateStr: string) {
    const date = new Date(dateStr);
    // 取 UTC 年月日
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  if (showAbout) {
    return (
      <div className="min-h-screen bg-#F7F8FA flex flex-col font-sans">
        <header className="flex items-center justify-between px-4 sm:px-12 py-6 bg-#F7F8FA">
          <div
            className="text-2xl font-semibold tracking-wide text-#232937 cursor-pointer"
            onClick={() => setShowAbout(false)}
          >
            摸鱼经济学
          </div>
          <button
            className="bg-#3ED598 text-#232937 px-6 py-2 text-base"
            onClick={() => setShowAbout(false)}
          >
            返回首页
          </button>
        </header>
        <About />
      </div>
    );
  }
  console.log(currentIdx, todayBriefsLen);

  return (
    <div className="min-h-screen bg-#F7F8FA flex flex-col font-sans">
      <header className="flex items-center justify-between px-4 sm:px-12 py-6 bg-#F7F8FA">
        <div className="text-2xl font-semibold tracking-wide text-#232937">
          摸鱼经济学
        </div>
        {/* 页面顶部右侧 GitHub 图标及链接 */}
        <div className="flex justify-end items-center mb-4 absolute top-6 right-6">
          {/* <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray hover:text-[#3ED598] transition-colors"
            aria-label="GitHub"
            title="GitHub: kylvia"
            style={{ fontSize: 12 }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              width="1.5em"
              height="1.5em"
            >
              <path d="M12 0C5.37 0 0 5.373 0 12c0 5.303 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.84 1.237 1.84 1.237 1.07 1.834 2.809 1.304 3.495.997.107-.775.418-1.305.762-1.605-2.665-.305-5.466-1.334-5.466-5.931 0-1.31.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.119 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.804 5.624-5.475 5.921.43.371.823 1.102.823 2.222v3.293c0 .322.218.694.825.576C20.565 21.796 24 17.299 24 12c0-6.627-5.373-12-12-12z" />
            </svg>
          </a> */}
          <button
            className="hover:text-[#3ED598] text-#232937 px-6 py-2 text-base"
            onClick={() => setShowAbout(true)}
          >
            关于
          </button>
        </div>
      </header>
      <main className="flex flex-col gap-8 max-w-7xl mx-auto w-full px-2 sm:px-8 py-4 sm:py-10">
        {/* 上方：左右布局，今日数据 */}
        <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
          {/* 左侧播放器 */}
          <section className="w-full sm:w-[370px] min-w-0 sm:min-w-[320px] max-w-full sm:max-w-[400px] flex flex-col items-center mb-6 sm:mb-0">
            <PlayerBar
              briefs={allBriefs}
              currentIdx={currentIdx}
              setCurrentIdx={setCurrentIdx}
              audioRef={audioRef}
              onEnded={handleEnded}
            />
          </section>
          {/* 右侧卡片列表（今日） */}
          <div className="flex-1 w-full">
            <h2 className="text-lg font-semibold mb-4 text-[#232937]">
              {" "}
              <span className="ml-2 text-xs text-accent bg-accent-light px-2 py-0.5 rounded">
                今日新闻
              </span>
            </h2>
            {loading ? (
              <div className="text-center text-#A3A7B3 animate-pulse mt-12">
                加载中...
              </div>
            ) : todayBriefs.length === 0 ? (
              <div className="text-center text-#A3A7B3 mt-12">今日暂无新闻</div>
            ) : (
              <BriefList
                briefs={todayBriefs.map((brief, i) => ({
                  ...brief,
                  publishedAt: formatDateToYYYYMMDD(brief.publishedAt),
                  _globalIdx: i,
                }))}
                currentIdx={currentIdx}
                onPlayIdx={(idx) => setCurrentIdx(idx)}
                hideDate={true}
              />
            )}
          </div>
        </div>
        {/* 下方：往日新闻列表 */}
        {!loading && otherBriefs.length > 0 && (
          <section className="w-full mt-4">
            <h2 className="text-lg font-semibold mb-4 text-[#232937]">
              往日新闻
            </h2>
            <BriefList
              briefs={otherBriefs.map((brief, i) => ({
                ...brief,
                publishedAt: formatDateToYYYYMMDD(brief.publishedAt),
                _globalIdx: i + todayBriefs.length,
              }))}
              currentIdx={currentIdx}
              onPlayIdx={(idx) => setCurrentIdx(idx)}
              hideDate={false}
            />
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
