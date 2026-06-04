/** 个人站点信息（按需修改） */
export const SITE = {
  name: '世界模拟',
  title: '做 Web 与三维场景',
  tagline: '程序化三维 · 实时渲染 · 交互模拟',
  description:
    '专注 Web 与程序化三维场景，正在构建一座可交互的模拟大世界。支持地形生成、模型挂点与实时探索。',
  // email: 'hello@example.com',
  // github: 'https://github.com/Hu-Te/the_world',
  nav: [
    { label: '关于', href: '#about' },
    { label: '作品', href: '#works' },
    { label: '联系', href: '#contact' },
  ],
  works: [
    {
      title: '模拟大世界',
      desc: '程序化生成的浮空地貌、地面聚落与写实地形，支持实时探索。',
      tags: [],
    },
    {
      title: '模型接入',
      desc: '预留挂点与模型注册表，支持场景资产按需替换与部署。',
      tags: [],
    },
    {
      title: '持续迭代中',
      desc: '建筑细节、地面山脉、后期效果与性能优化。',
      tags: [],
    },
  ],
  portals: [
    {
      title: '交互模拟',
      desc: '第三人称探索，接入节点、收集能量、完成主线任务。',
      href: '/game',
      label: '进入游戏',
      code: 'SIM-01',
    },
    {
      title: '沉浸世界',
      desc: '全屏三维场景，自由漫游程序化地形与浮空地貌。',
      href: '/world',
      label: '进入世界',
      code: 'WLD-02',
    },
    {
      title: '你画我猜',
      desc: '同屏派对：一人作画，其他人猜词，支持触控绘画。',
      href: '/draw',
      label: '开始游戏',
      code: 'DRW-03',
    },
  ],
} as const
