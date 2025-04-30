/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 仿图片风格主色
        surface: '#F7F8FA',        // 整体背景
        card: '#FFFFFF',           // 卡片背景
        cardActive: '#232937',     // 选中卡片背景
        cardBorder: '#E6E9EF',     // 卡片描边
        cardShadow: 'rgba(36, 44, 62, 0.08)',
        textMain: '#232937',       // 主文本
        textSub: '#A3A7B3',        // 副文本
        accent: '#3ED598',         // 绿色按钮/高亮
        accentLight: '#E9FAF3',    // 按钮浅绿背景
      },
      boxShadow: {
        card: '0 4px 24px 0 rgba(36, 44, 62, 0.08)',
        cardHover: '0 8px 32px 0 rgba(36, 44, 62, 0.12)',
      },
      fontFamily: {
        sans: ['Inter', 'PingFang SC', 'Microsoft YaHei', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
