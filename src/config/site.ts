/** 个人站点信息（按需修改） */
export const SITE = {
  name: '世界模拟',
  title: 'Web 三维场景',
  tagline: '程序化建模 · 实时渲染 · 交互仿真',
  description: '用浏览器做轻量三维仿真：探索场景、实用工具、即开即用。',
  privacyNotice: '本站不收集、不缓存个人数据，请放心体验。',
  // email: 'hello@example.com',
  // github: 'https://github.com/Hu-Te/the_world',
  nav: [
    { label: '关于', href: '#about' },
    { label: '作品', href: '#works' },
    { label: '联系', href: '#contact' },
  ],
  works: [
    {
      title: '场景探索',
      desc: '进入三维世界，自由漫游。',
      tags: [],
    },
    {
      title: '实用工具',
      desc: '右下角工具箱，按需扩展。',
      tags: [],
    },
    {
      title: '持续更新',
      desc: '功能逐步完善，保持简单可用。',
      tags: [],
    },
  ],
  portals: [
    {
      title: '交互模拟',
      desc: '第三人称探索与小任务。',
      href: '/game',
      label: '进入',
      code: '01',
    },
    {
      title: '沉浸世界',
      desc: '全屏三维场景漫游。',
      href: '/world',
      label: '进入',
      code: '02',
    },
    {
      title: '你画我猜',
      desc: '同屏派对，触控绘画。',
      href: '/draw',
      label: '进入',
      code: '03',
    },
  ],
} as const
