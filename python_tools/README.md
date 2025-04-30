# Python MP3 News Briefs Merger

这个Python工具用于下载和合并新闻简报的MP3文件。它从OSS服务器获取简报信息，筛选特定时间范围内的简报，下载对应的MP3文件，然后将它们合并成一个单独的音频文件。

## 功能特点

- 从OSS服务器获取简报数据
- 按时间范围筛选简报（默认最近6小时）
- 多线程并行下载MP3文件，提高效率
- 使用pydub库合并音频文件
- 详细的日志和进度显示
- 自动清理临时文件

## 安装依赖

```bash
pip install -r requirements.txt
```

## 使用方法

基本用法:

```bash
python merge_mp3_briefs.py
```

这将使用默认参数运行脚本，获取最近6小时的简报并将合并的MP3文件保存到当前目录。

### 命令行参数

```
usage: merge_mp3_briefs.py [-h] [--hours HOURS] [--url URL] [--output OUTPUT] [--verbose] [--keep-temp]

选项:
  -h, --help            显示此帮助信息并退出
  --hours HOURS, -t HOURS
                        时间窗口，单位为小时（默认：6）
  --url URL, -u URL     briefs.json文件的URL（默认：https://oj-news-text-jp.oss-ap-northeast-1.aliyuncs.com/briefs.json）
  --output OUTPUT, -o OUTPUT
                        输出目录（默认：当前工作目录）
  --verbose, -v         启用详细输出
  --keep-temp, -k       保留合并后的临时文件
```

### 示例

获取最近12小时的简报:

```bash
python merge_mp3_briefs.py --hours 12
```

指定输出目录:

```bash
python merge_mp3_briefs.py --output /path/to/output/directory
```

详细模式:

```bash
python merge_mp3_briefs.py --verbose
```

## 要求

- Python 3.7+
- 外部依赖包（见requirements.txt）
