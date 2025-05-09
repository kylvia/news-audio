import React from "react";
import { BriefItem } from "../types";

interface BriefListProps {
  briefs: BriefItem[];
  currentIdx: number;
  onPlayIdx: (idx: number) => void;
  hideDate?: boolean;
}

const BriefList: React.FC<BriefListProps> = ({
  briefs,
  currentIdx,
  onPlayIdx,
  hideDate,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-7 w-full">
      {briefs.map((item, idx) => {
        // 优化：统一获取全局索引，避免多次重复判断
        const globalIdx =
          typeof item._globalIdx === "number" ? item._globalIdx : idx;
        return (
          <div
            key={item.title + item.publishedAt}
            className={`bg-card rounded-2xl shadow-card flex flex-col border border-card transition-all duration-200 min-h-[140px] justify-between px-4 sm:px-6 py-4 sm:py-5 cursor-pointer group ${
              currentIdx === globalIdx
                ? "bg-card-active text-white border-0 shadow-card-hover scale-[1.03]"
                : "hover:shadow-card-hover"
            }`}
            onClick={() => onPlayIdx(globalIdx)}
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 mb-1">
                <div
                  className={`text-base font-bold break-words whitespace-normal max-w-full ${
                    currentIdx === globalIdx ? "text-white" : "text-main"
                  }`}
                >
                  {item.title}
                </div>
                {!hideDate && (
                  <div
                    className={`text-xs text-right whitespace-nowrap ${
                      currentIdx === globalIdx ? "text-accent" : "text-sub"
                    }`}
                  >
                    {item.publishedAt
                      ? (() => {
                          try {
                            // 尝试直接解析ISO日期字符串
                            const date = new Date(item.publishedAt);
                            // 尝试强制使用24小时制格式
                            return `${date.getFullYear()}/${(
                              date.getMonth() + 1
                            )
                              .toString()
                              .padStart(2, "0")}/${date
                              .getDate()
                              .toString()
                              .padStart(2, "0")} ${date
                              .getHours()
                              .toString()
                              .padStart(2, "0")}:${date
                              .getMinutes()
                              .toString()
                              .padStart(2, "0")}`;
                          } catch (e) {
                            console.error("日期解析错误:", e, item.publishedAt);
                            return item.publishedAt || "";
                          }
                        })()
                      : ""}
                  </div>
                )}
              </div>
              <div
                className={`text-xs opacity-90 line-clamp-2 mb-2 ${
                  currentIdx === globalIdx ? "text-white/80" : "text-main/80"
                }`}
              >
                {item.brief}
              </div>
            </div>
            <div className="flex sm:flex-row items-center gap-2 sm:gap-3 mt-auto justify-between">
              <span
                className={`text-xs font-mono px-2 py-1 rounded-full ${
                  currentIdx === globalIdx
                    ? "bg-accent-light text-accent"
                    : "bg-surface text-sub"
                }`}
              >
                {item.source}
              </span>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`text-xs underline ${
                  currentIdx === globalIdx
                    ? "text-accent"
                    : "text-accent hover:text-main"
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                原文链接
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default BriefList;
