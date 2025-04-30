import React, { useState } from "react";
import { BriefItem } from "../types";

interface PlayerBarProps {
  briefs: BriefItem[];
  currentIdx: number;
  setCurrentIdx: (idx: number) => void;
  audioRef: React.RefObject<HTMLAudioElement>;
  onEnded: () => void;
}

const PlayerBar: React.FC<PlayerBarProps> = ({
  briefs,
  currentIdx,
  setCurrentIdx,
  audioRef,
  onEnded,
}) => {
  const current = briefs[currentIdx];
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < briefs.length - 1;
  const [isPlaying, setIsPlaying] = useState(false);

  console.log(isPlaying);

  const handlePrev = () => {
    if (hasPrev) setCurrentIdx(currentIdx - 1);
  };
  const handleNext = () => {
    if (hasNext) setCurrentIdx(currentIdx + 1);
  };

  const handlePlay = () => {
    audioRef.current?.play();
  };
  const handlePause = () => {
    audioRef.current?.pause();
  };

  // 自动切歌：音频结束时自动播放下一条
  const handleAudioEnded = () => {
    if (currentIdx < briefs.length - 1) {
      setCurrentIdx(currentIdx + 1);
      setTimeout(() => {
        audioRef.current?.play();
      }, 0); // 等待src切换后再play
    } else {
      setIsPlaying(false);
    }
    // 若需要循环播放全部，可在此处重置currentIdx=0
  };

  function formatDateToYYYYMMDD(dateStr: string) {
    const date = new Date(dateStr);
    // 取 UTC 年月日
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  return (
    <div className="bg-card rounded-3xl shadow-card p-8 mb-8 flex flex-col items-center border border-card w-full">
      {/* 封面大图标 */}
      <div className="w-48 h-48 rounded-2xl bg-[#232937] flex items-center justify-center shadow-card mb-6">
        <img src="/images/music.svg" alt="音乐封面" className="w-24 h-24" />
      </div>
      {/* 标题和进度 */}
      <div
        className="text-main text-lg font-bold text-center mb-2 truncate w-full"
        title={current?.title}
      >
        {current ? current.title : "暂无简报"}
      </div>
      <div className="text-sub text-sm text-center mb-4">
        {current?.category || ""}
      </div>
      {/* 音频控件 */}
      <audio
        ref={audioRef}
        src={current?.audioUrl}
        controls
        autoPlay
        onEnded={handleAudioEnded}
        className="w-full mb-4"
        style={{ background: "transparent", borderRadius: 8 }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />
      {/* 简报内容区 */}
      <div className="bg-[#F7F8FA] rounded-xl p-4 mt-2 text-main text-base max-h-80 overflow-auto shadow-inner w-full">
        {current?.brief || "暂无简报内容"}
        {current?.url && (
          <a
            href={current.url}
            className="ml-2 link-accent inline-block"
            target="_blank"
            rel="noopener noreferrer"
          >
            原文链接
          </a>
        )}
        {current?.publishedAt && (
          <div className="text-sub text-sm text-right mt-2">
            {formatDateToYYYYMMDD(current.publishedAt)}
          </div>
        )}
      </div>
      <div className="flex items-center justify-center gap-6 mt-3">
        <button
          className="btn-accent w-12 h-12 flex items-center justify-center text-xl disabled:opacity-40"
          onClick={handlePrev}
          disabled={!hasPrev}
          aria-label="上一条"
        >
          <img src="/images/prev.svg" alt="上一条" className="w-5 h-5" />
        </button>

        {/* 控制按钮 */}
        {isPlaying ? (
          <button
            className="btn-control btn-accent w-12 h-12 flex items-center justify-center text-xl disabled:opacity-40"
            onClick={handlePause}
            aria-label="暂停"
          >
            <img src="/images/stop.svg" alt="暂停" className="w-7 h-7" />
          </button>
        ) : (
          <button
            className="btn-control btn-accent w-12 h-12 flex items-center justify-center text-xl disabled:opacity-40"
            onClick={handlePlay}
            aria-label="播放"
          >
            <img src="/images/start.svg" alt="播放" className="w-7 h-7" />
          </button>
        )}
        <button
          className="btn-accent w-12 h-12 flex items-center justify-center text-xl disabled:opacity-40"
          onClick={handleNext}
          disabled={!hasNext}
          aria-label="下一条"
        >
          <img src="/images/next.svg" alt="下一条" className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default PlayerBar;
