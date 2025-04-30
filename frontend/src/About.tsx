import React from "react";

const About = () => (
  <div className="w-full max-w-xl sm:max-w-2xl mx-auto px-4 py-4 sm:px-6 sm:py-8 text-main relative">
    <h1 className="text-lg sm:text-2xl font-bold mb-3 sm:mb-4 text-center">
      《摸鱼经济学》
    </h1>

    <div className="flex items-center text-main text-sm sm:text-base mb-4">
      <span className="mr-2">👉</span>
      <a
        href="https://www.xiaoyuzhoufm.com/podcast/680b50ea1168df730183ae30"
        className="link-accent underline break-all"
        target="_blank"
        rel="noopener noreferrer"
      >
        小宇宙传送门
      </a>{" "}
    </div>
    <blockquote className="italic text-base sm:text-lg mb-4 sm:mb-6 border-l-4 pl-3 sm:pl-4 border-accent bg-surface rounded-sm">
      “别让信息爆炸成为你的精神加班！”
    </blockquote>
    <h2 className="text-base sm:text-xl font-semibold mt-5 sm:mt-6 mb-2 flex items-center">
      <span className="mr-2">🎧</span>《AI摸鱼经济学》信奉三条法则：
    </h2>
    <ul
      className="list-none text-sm sm:text-base text-sub mb-3 sm:mb-4 space-y-2"
      style={{ paddingLeft: 0 }}
    >
      <li>
        1️⃣ 不是所有新闻都值得你颅内加班——
        <span className="whitespace-nowrap">我们已用AI过滤掉99%的噪音</span>
      </li>
      <li>
        2️⃣ 通勤时间≠第二工位——
        <span className="whitespace-nowrap">
          20分钟简报设计精确匹配地铁到站时长
        </span>
      </li>
      <li>
        3️⃣ 允许自己「知道但不焦虑」——
        <span className="whitespace-nowrap">
          所有科技趋势都附赠「关我屁事」指数评分
        </span>
      </li>
    </ul>
    <h2 className="text-base sm:text-xl font-semibold mt-5 sm:mt-6 mb-2 flex items-center">
      <span className="mr-2">🎉</span>今天起，试试用摸鱼的心态吸收知识：
    </h2>
    <ul className="list-disc list-inside text-sm sm:text-base text-sub mb-3 sm:mb-4 space-y-1">
      <li>✓ 比特币暴跌？就当看科幻片</li>
      <li>✓ AI取代人类？先让它帮你写周报</li>
      <li>✓ 美联储加息？换算成奶茶预算就好</li>
    </ul>
    <div className="text-sm sm:text-base text-sub mb-5 sm:mb-6">
      <span className="pl-2 sm:pl-4 block leading-relaxed">
        「记住：世界从不因你多焦虑而改变，但你可以因少看垃圾信息而活得更好。」
      </span>
    </div>

    <div className="flex flex-col items-center my-8">
      <div className="text-base sm:text-lg font-semibold mb-3 text-main text-center">
        既然都来到这里了，不如请阿狸喝杯咖啡吧 ☕️
      </div>
      <div className=" inline-flex items-center justify-center w-48 h-48 rounded-lg shadow-lg border border-gray-200 object-contain bg-white">
        <img
          src="/images/wx-qr.jpg"
          alt="微信收款码"
          style={{ maxWidth: 180 }}
        />
      </div>
      <div className="text-xs text-sub mt-2 text-center">
        微信扫码支持，感谢你的鼓励！
      </div>
    </div>

    {/* <h2 className="text-base sm:text-xl font-semibold mt-6 mb-2">技术栈</h2>
    <ul className="list-disc list-inside text-sm sm:text-base text-sub mb-4">
      <li>React 18 + TypeScript 前端</li>
      <li>Tailwind CSS 现代化样式</li>
      <li>Vite 极速开发环境</li>
      <li>自动化新闻抓取与 TTS 合成后端</li>
    </ul> */}
    <p className="text-base text-sub mb-4">
      本项目开源，仅供学习与非商业用途。内容与音频均来自公开渠道和 AI 自动生成。
    </p>
    <div className="text-base text-sub">
      GitHub:{" "}
      <a
        href="https://github.com/kylvia"
        target="_blank"
        rel="noopener noreferrer"
        className="link-accent"
      >
        kylvia
      </a>
    </div>
  </div>
);

export default About;
