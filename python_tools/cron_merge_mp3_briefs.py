import sys
import time
from datetime import datetime, timedelta, timezone
from merge_mp3_briefs import main as merge_main
import subprocess
import os

def run_once_and_schedule():
    # 不再启动时立即合并一次，只设置定时任务
    print(f"[定时任务] 启动定时任务: {datetime.now(timezone(timedelta(hours=8))).strftime('%Y-%m-%d %H:%M:%S')}")


    # 每天两次：06:50 和 16:50（北京时间）
    target_hours_minutes = [(6, 50), (16, 50)]
    tz_beijing = timezone(timedelta(hours=8))
    while True:
        now = datetime.now(tz_beijing)
        now_seconds = now.hour * 3600 + now.minute * 60 + now.second
        # 计算距离下一个目标时间的秒数
        next_times = []
        for h, m in target_hours_minutes:
            t_seconds = h * 3600 + m * 60
            if t_seconds > now_seconds:
                next_times.append((t_seconds - now_seconds, h, m))
        if not next_times:
            # 今天的都过了，跳到明天的第一个
            h, m = target_hours_minutes[0]
            t_seconds = h * 3600 + m * 60
            next_times.append((24 * 3600 - now_seconds + t_seconds, h, m))
        sleep_seconds, next_h, next_m = min(next_times)
        print(f"[定时任务] 距离下次合并还有 {sleep_seconds // 3600} 小时 {sleep_seconds % 3600 // 60} 分钟")
        time.sleep(sleep_seconds)
        # 计算合并区间
        now = datetime.now(tz_beijing)
        if next_h == 6 and next_m == 50:
            # 合并前一天16:50到当天6:50
            start_dt = (now - timedelta(days=1)).replace(hour=16, minute=50, second=0, microsecond=0)
            end_dt = now.replace(hour=6, minute=50, second=0, microsecond=0)
        else:
            # 合并当天6:50到16:50
            start_dt = now.replace(hour=6, minute=50, second=0, microsecond=0)
            end_dt = now.replace(hour=16, minute=50, second=0, microsecond=0)
        start_iso = start_dt.isoformat()
        end_iso = end_dt.isoformat()
        print(f"[定时任务] 开始自动合并新闻音频: {now.strftime('%Y-%m-%d %H:%M:%S')} 合并区间: {start_iso} ~ {end_iso}")
        try:
            # 通过命令行参数调用 main（兼容 argparse）
            cmd = [sys.executable, os.path.join(os.path.dirname(__file__), "merge_mp3_briefs.py"), "--start", start_iso, "--end", end_iso]
            ret = subprocess.run(cmd, check=True)
            print(f"[定时任务] 合并任务完成: {now.strftime('%Y-%m-%d %H:%M:%S')}")
        except Exception as e:
            print(f"[定时任务] 合并任务异常: {e}", file=sys.stderr)

if __name__ == "__main__":
    run_once_and_schedule()
