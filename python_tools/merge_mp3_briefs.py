#!/usr/bin/env python3
"""
MP3 News Briefs Merger

This script downloads news brief MP3 files from a briefs.json file on OSS,
filters them by time range, and merges them into a single MP3 file.
"""

import os
import sys
import json
import time
import argparse
import tempfile
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor
import requests
from dateutil import parser
from tqdm import tqdm
from pydub import AudioSegment
import urllib.request
import oss2  # 阿里云 OSS Python SDK

# 配置日志输出
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("news-audio")

# 默认URL和超时设置
OSS_ENDPOINT = os.environ.get("OSS_ENDPOINT")
OSS_TEXT_BUCKET = os.environ.get("OSS_TEXT_BUCKET")
if OSS_ENDPOINT and OSS_TEXT_BUCKET:
    DEFAULT_BRIEFS_JSON_URL = f"https://{OSS_TEXT_BUCKET}.{OSS_ENDPOINT}/briefs.json"
else:
    DEFAULT_BRIEFS_JSON_URL = "https://oj-news-text-jp.oss-ap-northeast-1.aliyuncs.com/briefs.json"
DEFAULT_TIMEOUT = 60  # 60秒
MAX_WORKERS = 4  # 并行下载的最大线程数

# 每日介绍音频URL格式
OSS_AUDIO_BUCKET = os.environ.get("OSS_AUDIO_BUCKET")
if OSS_ENDPOINT and OSS_AUDIO_BUCKET:
    DAILY_INTRO_URL_TEMPLATE = f"https://{OSS_AUDIO_BUCKET}.{OSS_ENDPOINT}/daily-intro-{{date}}.mp3"
else:
    DAILY_INTRO_URL_TEMPLATE = "http://oj-news-audio-jp.oss-ap-northeast-1.aliyuncs.com/daily-intro-{date}.mp3"


class Brief:
    """简报数据结构"""
    def __init__(self, data):
        self.id = data.get("id", "")
        self.title = data.get("title", "")
        self.brief = data.get("brief", "")
        self.published_at = data.get("publishedAt", "")
        self.audio_url = data.get("audioUrl", "")
        self.url = data.get("url", "")
        self.category = data.get("category", "")
        # 本地环境下修正音频URL（oss-ap-northeast-1-internal -> oss-ap-northeast-1）
        if self.audio_url and is_local_env():
            self.audio_url = self.audio_url.replace("oss-ap-northeast-1-internal", "oss-ap-northeast-1")
        # 解析发布时间
        try:
            # 确保解析出的时间是UTC时区感知的
            dt = parser.parse(self.published_at)
            if dt.tzinfo is None:
                # 如果时间没有时区信息，添加UTC时区
                self.published_date = dt.replace(tzinfo=timezone.utc)
            else:
                self.published_date = dt
        except (ValueError, TypeError):
            self.published_date = None
    
    def is_valid(self):
        """检查简报是否有效"""
        return bool(self.id and self.title and self.published_date and self.audio_url)
    
    def __str__(self):
        return f"{self.title} ({self.published_at})"


def is_local_env():
    # 没有 OSS_ENDPOINT 环境变量时视为本地环境
    return not os.environ.get("OSS_ENDPOINT")


def parse_arguments():
    """解析命令行参数"""
    parser = argparse.ArgumentParser(description="Download and merge MP3 news briefs.")
    parser.add_argument(
        "--hours", "-t", 
        type=int, 
        default=None, 
        help="Time window in hours (default: None, mutually exclusive with --start/--end)"
    )
    parser.add_argument(
        "--start", type=str, default=None, help="Start datetime (ISO8601, e.g. 2025-04-26T16:50:00+08:00)"
    )
    parser.add_argument(
        "--end", type=str, default=None, help="End datetime (ISO8601, e.g. 2025-04-27T06:50:00+08:00)"
    )
    parser.add_argument(
        "--url", "-u", 
        type=str, 
        default=DEFAULT_BRIEFS_JSON_URL, 
        help=f"URL of the briefs.json file (default: {DEFAULT_BRIEFS_JSON_URL})"
    )
    parser.add_argument(
        "--output", "-o", 
        type=str, 
        default=None, 
        help="Output directory (default: current working directory)"
    )
    parser.add_argument(
        "--verbose", "-v", 
        action="store_true", 
        help="Enable verbose output"
    )
    parser.add_argument(
        "--keep-temp", "-k", 
        action="store_true", 
        help="Keep temporary files after merging"
    )
    parser.add_argument(
        "--skip-intro", "-s", 
        action="store_true", 
        help="Skip daily intro audio"
    )
    return parser.parse_args()


def format_filesize(size_bytes):
    """格式化文件大小"""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes/1024:.2f} KB"
    else:
        return f"{size_bytes/(1024*1024):.2f} MB"


def fetch_briefs_json(url, timeout=DEFAULT_TIMEOUT):
    """获取briefs.json文件"""
    logger.info(f"正在获取简报数据：{url}")
    start_time = time.time()
    
    try:
        response = requests.get(url, timeout=timeout, stream=True)
        response.raise_for_status()
        
        # 获取总大小（如果有）
        total_size = int(response.headers.get('content-length', 0))
        
        # 设置进度条
        progress_bar = None
        if total_size > 0:
            progress_bar = tqdm(
                total=total_size,
                unit='B',
                unit_scale=True,
                desc='下载简报数据'
            )
        chunks = []
        downloaded = 0
        for chunk in response.iter_content(chunk_size=8192):
            if chunk:
                chunks.append(chunk)
                downloaded += len(chunk)
                if progress_bar:
                    progress_bar.update(len(chunk))
        if progress_bar:
            progress_bar.close()
        content = b''.join(chunks)
        duration = time.time() - start_time
        logger.info(f"简报数据获取完成，大小：{format_filesize(downloaded)}，耗时：{duration:.2f}秒")
        return json.loads(content)
    except requests.exceptions.HTTPError as e:
        logger.error(f"获取简报数据失败: HTTP错误 {e.response.status_code} - {e.response.reason}")
        logger.error(f"响应内容: {e.response.text}")
        return None
    except Exception as e:
        logger.error(f"获取简报数据失败: {str(e)}")
        return None


def filter_briefs_by_time(briefs_data, hours):
    """按时间过滤简报"""
    now = datetime.now(timezone.utc)
    start_time = now - timedelta(hours=hours)
    
    logger.info(f"过滤{hours}小时内的简报 ({start_time.isoformat()} 到 {now.isoformat()})")
    
    filtered_briefs = []
    skipped_count = {
        "no_date": 0,
        "too_old": 0,
        "too_new": 0,
        "no_audio": 0,
        "invalid": 0
    }
    
    # 解析并过滤简报
    for item in briefs_data:
        brief = Brief(item)
        
        if not brief.published_date:
            logger.debug(f"跳过无效日期的简报: {brief.title}")
            skipped_count["no_date"] += 1
            continue
            
        if brief.published_date < start_time:
            logger.debug(f"跳过较早的简报: {brief.title} ({brief.published_date.isoformat()})")
            skipped_count["too_old"] += 1
            continue
            
        if brief.published_date > now:
            logger.debug(f"跳过未来的简报: {brief.title} ({brief.published_date.isoformat()})")
            skipped_count["too_new"] += 1
            continue
            
        if not brief.audio_url:
            logger.debug(f"跳过无音频URL的简报: {brief.title}")
            skipped_count["no_audio"] += 1
            continue
            
        if not brief.is_valid():
            logger.debug(f"跳过无效简报: {brief.title}")
            skipped_count["invalid"] += 1
            continue
            
        filtered_briefs.append(brief)
    
    # 按发布时间从新到旧排序
    filtered_briefs.sort(key=lambda x: x.published_date, reverse=True)
    
    logger.info(f"找到{len(filtered_briefs)}条符合条件的简报")
    logger.info(f"跳过的简报统计: 无日期={skipped_count['no_date']}, 太早={skipped_count['too_old']}, "
                f"太新={skipped_count['too_new']}, 无音频={skipped_count['no_audio']}, "
                f"无效={skipped_count['invalid']}")
    
    # 输出找到的简报
    for i, brief in enumerate(filtered_briefs):
        logger.info(f"#{i+1}: {brief.title} - {brief.published_date.isoformat()}")
    
    return filtered_briefs


def filter_briefs_by_time_range(briefs_data, start_iso, end_iso):
    """按时间区间过滤简报（ISO8601字符串，含时区）"""
    from dateutil import parser as dtparser
    start_dt = dtparser.parse(start_iso)
    end_dt = dtparser.parse(end_iso)
    filtered = []
    for b in briefs_data:
        try:
            dt = dtparser.parse(b.get("publishedAt", ""))
            if start_dt <= dt < end_dt:
                filtered.append(b)
        except Exception:
            continue
    return filtered


def download_mp3_file(brief, index, total, temp_dir):
    """下载单个MP3文件"""
    filename = f"{index+1}-{brief.id}.mp3"
    filepath = os.path.join(temp_dir, filename)
    
    logger.info(f"下载 {index+1}/{total}: {brief.title}")
    logger.info(f"音频URL: {brief.audio_url}")
    
    try:
        start_time = time.time()
        
        # 发送请求获取文件
        response = requests.get(brief.audio_url, stream=True, timeout=DEFAULT_TIMEOUT)
        response.raise_for_status()
        
        # 获取文件大小
        file_size = int(response.headers.get('content-length', 0))
        
        # 设置进度条
        progress_bar = tqdm(
            total=file_size,
            unit='B',
            unit_scale=True,
            desc=f"下载 #{index+1}"
        )
        
        # 分块下载
        with open(filepath, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    progress_bar.update(len(chunk))
        
        progress_bar.close()
        
        duration = time.time() - start_time
        download_speed = file_size / (duration * 1024 * 1024) if duration > 0 else 0
        
        logger.info(f"文件 {index+1}/{total} 下载完成，耗时: {duration:.2f}秒, "
                   f"大小: {format_filesize(file_size)}, 速度: {download_speed:.2f} MB/s")
        
        return filepath, file_size, True
    except Exception as e:
        logger.error(f"下载文件失败 {index+1}/{total}: {brief.title} - {str(e)}")
        return filepath, 0, False


def download_mp3_files(briefs, temp_dir):
    """并行下载所有MP3文件"""
    if not briefs:
        logger.warning("没有找到符合条件的简报")
        return []
    
    logger.info(f"开始下载{len(briefs)}个MP3文件到临时目录: {temp_dir}")
    
    # 存储下载结果
    download_results = []
    total_size = 0
    success_count = 0
    fail_count = 0
    
    start_time = time.time()
    
    # 使用线程池并行下载
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = []
        for i, brief in enumerate(briefs):
            future = executor.submit(download_mp3_file, brief, i, len(briefs), temp_dir)
            futures.append(future)
        
        # 收集结果
        for future in futures:
            filepath, file_size, success = future.result()
            download_results.append((filepath, file_size, success))
            
            if success:
                success_count += 1
                total_size += file_size
            else:
                fail_count += 1
    
    # 过滤出成功下载的文件
    successful_files = [result[0] for result in download_results if result[2]]
    
    total_duration = time.time() - start_time
    avg_speed = total_size / (total_duration * 1024 * 1024) if total_duration > 0 else 0
    
    logger.info("下载统计:")
    logger.info(f"总文件数: {len(briefs)}")
    logger.info(f"成功: {success_count}, 失败: {fail_count}")
    logger.info(f"总大小: {format_filesize(total_size)}")
    logger.info(f"总耗时: {total_duration:.2f}秒")
    logger.info(f"平均下载速度: {avg_speed:.2f} MB/s")
    
    return successful_files


def download_daily_intro(temp_dir):
    """下载每日介绍音频"""
    now = datetime.now(timezone.utc)
    # 转换为北京时间 (UTC+8)
    beijing_time = now + timedelta(hours=8)
    date_str = beijing_time.strftime("%Y%m%d")
    
    # 构建介绍音频URL
    intro_url = DAILY_INTRO_URL_TEMPLATE.format(date=date_str)
    intro_file = os.path.join(temp_dir, "daily-intro.mp3")
    
    logger.info(f"尝试下载每日介绍音频: {intro_url}")
    try:
        # 下载文件
        urllib.request.urlretrieve(intro_url, intro_file)
        logger.info(f"每日介绍音频下载成功: {intro_file}")
        return intro_file
    except Exception as e:
        logger.warning(f"下载每日介绍音频失败: {str(e)}")
        return None


def merge_mp3_files(mp3_files, output_file, intro_file=None):
    """
    使用pydub合并MP3文件
    mp3_files: 新闻音频列表
    output_file: 输出文件
    intro_file: 可选，开头插入的每日介绍音频
    结尾自动追加 end.mp3（如存在）
    简报之间自动插入 keyboard-typing.mp3（如存在），但第一个和最后一个之间不加
    """
    from pydub import AudioSegment
    import os
    merged = None
    # 插入每日介绍
    if intro_file and os.path.exists(intro_file):
        merged = AudioSegment.from_mp3(intro_file)
        logger.info(f"[合并] 插入每日介绍: {intro_file}")
    # 加载打字音效
    typing_path = os.path.join(os.path.dirname(__file__), "keyboard-typing.mp3")
    typing_audio = AudioSegment.from_mp3(typing_path) if os.path.exists(typing_path) else None
    # 合并新闻音频，只有在中间插入打字音效
    for i, f in enumerate(mp3_files):
        try:
            seg = AudioSegment.from_mp3(f)
            if merged is None:
                merged = seg
            else:
                # 仅在不是第一个且不是最后一个前插入打字音效
                if typing_audio and i > 0:
                    merged += typing_audio
                    logger.info(f"[合并] 插入打字音效: {typing_path}")
                merged += seg
            logger.info(f"[合并] 加入第{i+1}条: {f}")
        except Exception as e:
            logger.error(f"[合并] 跳过损坏文件: {f}, 错误: {e}")
    # 结尾插入 end.mp3
    end_path = os.path.join(os.path.dirname(__file__), "end.mp3")
    if os.path.exists(end_path):
        try:
            end_audio = AudioSegment.from_mp3(end_path)
            merged += end_audio
            logger.info(f"[合并] 结尾插入 end.mp3")
        except Exception as e:
            logger.warning(f"[合并] 结尾音频损坏: {e}")
    merged.export(output_file, format="mp3")
    logger.info(f"[合并] 已输出: {output_file}")
    return True


def generate_summary_text(briefs, output_file):
    """生成简报标题摘要文本文件"""
    if not briefs:
        logger.warning("没有简报可以生成摘要")
        return False
    
    try:
        logger.info(f"正在生成简报摘要到: {output_file}")
        
        # 获取当前日期时间
        now = datetime.now()
        formatted_date = now.strftime("%Y年%m月%d日 %H:%M")
        
        # 准备文件内容
        lines = [
            f"新闻简报摘要（{formatted_date}）\n"
        ]
        for i, brief in enumerate(briefs, 1):
            lines.append(f"{i}. {brief.title}")
        lines.append("")
        lines.append("更多详细信息请前往http://eco.moyuba.top")
        
        with open(output_file, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        logger.info(f"摘要文件生成完成: {output_file}")
        return True
    except Exception as e:
        logger.error(f"生成摘要文件失败: {e}")
        return False


# 上传文件到阿里云 OSS
def upload_to_oss(local_file, object_name=None):
    """
    上传本地文件到阿里云 OSS，返回文件的公网URL
    环境变量：
        OSS_ENDPOINT, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_BUCKET_NAME, OSS_PUBLIC_URL_PREFIX
    """
    import os
    endpoint = os.environ.get("OSS_ENDPOINT")
    access_key_id = os.environ.get("OSS_ACCESS_KEY_ID")
    access_key_secret = os.environ.get("OSS_ACCESS_KEY_SECRET")
    bucket_name = os.environ.get("OSS_BUCKET_NAME")
    url_prefix = os.environ.get("OSS_PUBLIC_URL_PREFIX")  # 如 https://bucket-name.oss-region.aliyuncs.com/

    if not all([endpoint, access_key_id, access_key_secret, bucket_name, url_prefix]):
        logger.error("OSS配置不完整，请设置环境变量：OSS_ENDPOINT, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_BUCKET_NAME, OSS_PUBLIC_URL_PREFIX")
        return None

    # 生成object_name
    import time
    if object_name is None:
        # 默认用文件名+时间戳
        base = os.path.basename(local_file)
        object_name = f"news-audio/{int(time.time())}_{base}"

    auth = oss2.Auth(access_key_id, access_key_secret)
    bucket = oss2.Bucket(auth, endpoint, bucket_name)
    try:
        bucket.put_object_from_file(object_name, local_file)
        url = url_prefix.rstrip("/") + "/" + object_name
        logger.info(f"已上传到OSS: {url}")
        return url
    except Exception as e:
        logger.error(f"上传到OSS失败: {e}")
        return None


def main():
    """主函数"""
    args = parse_arguments()
    
    # 设置日志级别
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    
    # 设置输出目录
    output_dir = args.output or os.getcwd()
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # 获取当前时间作为文件名
    now = datetime.now()
    timestamp = now.strftime("%Y%m%d-%H%M")
    output_file = os.path.join(output_dir, f"news-{timestamp}.mp3")
    summary_file = os.path.join(output_dir, f"summary-{timestamp}.md")
    
    # 创建临时目录
    temp_dir = os.path.join(tempfile.gettempdir(), f"news-audio-merge-{int(time.time())}")
    os.makedirs(temp_dir, exist_ok=True)
    
    try:
        # 获取简报数据
        briefs_data = fetch_briefs_json(args.url)
        
        if briefs_data is None:
            logger.error("获取简报数据失败")
            return
        
        # 新增：支持按时间区间过滤
        if args.start and args.end:
            filtered_briefs = filter_briefs_by_time_range(briefs_data, args.start, args.end)
        elif args.hours:
            filtered_briefs = filter_briefs_by_time(briefs_data, args.hours)
        else:
            logger.error("请指定 --hours 或 --start 和 --end")
            return
        
        if not filtered_briefs:
            logger.warning("未找到指定时间范围内的MP3文件，退出")
            return
        
        # 确保所有brief都是Brief对象（修复dict属性访问错误）
        filtered_briefs = [Brief(b) if not isinstance(b, Brief) else b for b in filtered_briefs]
        
        # 生成简报摘要文本文件
        generate_summary_text(filtered_briefs, summary_file)
        
        # 下载MP3文件
        mp3_files = download_mp3_files(filtered_briefs, temp_dir)
        
        if not mp3_files:
            logger.warning("没有成功下载的文件，退出")
            return
        
        # 下载每日介绍音频（如果不跳过）
        intro_file = None
        if not args.skip_intro:
            intro_file = download_daily_intro(temp_dir)
        
        # 合并MP3文件
        success = merge_mp3_files(mp3_files, output_file, intro_file)

        if success:
            logger.info(f"处理完成！最终文件：{output_file}")
            logger.info(f"简报摘要文件：{summary_file}")
            # === 新增：自动上传OSS ===
            oss_url = upload_to_oss(output_file)
            if oss_url:
                logger.info(f"OSS文件地址：{oss_url}")
            else:
                logger.warning("OSS上传失败")
            # === 新增：上传摘要markdown文件 ===
            md_oss_url = upload_to_oss(summary_file)
            if md_oss_url:
                logger.info(f"OSS摘要文件地址：{md_oss_url}")
            else:
                logger.warning("OSS摘要文件上传失败")
        else:
            logger.error("处理失败")
    
    finally:
        # 清理临时文件
        if not args.keep_temp and os.path.exists(temp_dir):
            logger.info(f"清理临时目录: {temp_dir}")
            try:
                for file in os.listdir(temp_dir):
                    os.remove(os.path.join(temp_dir, file))
                os.rmdir(temp_dir)
            except Exception as e:
                logger.warning(f"清理临时目录时出错: {str(e)}")


if __name__ == "__main__":
    main()
