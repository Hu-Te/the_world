/** 你画我猜词库 */
export const DRAW_WORDS = [
  '太阳', '月亮', '彩虹', '闪电', '雪人', '风筝', '气球', '蛋糕',
  '咖啡', '披萨', '汉堡', '苹果', '西瓜', '香蕉', '冰淇淋', '火锅',
  '猫', '狗', '兔子', '熊猫', '恐龙', '蝴蝶', '章鱼', '长颈鹿',
  '汽车', '飞机', '火箭', '自行车', '地铁', '热气球', '潜水艇', '机器人',
  '手机', '电脑', '相机', '耳机', '游戏手柄', '键盘', '电视', '灯泡',
  '医生', '警察', '消防员', '宇航员', '厨师', '画家', '魔术师', '超人',
  '足球', '篮球', '游泳', '滑雪', '钓鱼', '拳击', '跳绳', '瑜伽',
  '学校', '医院', '图书馆', '超市', '电影院', '游乐园', '海滩', '森林',
  '睡觉', '刷牙', '拍照', '跳舞', '唱歌', '哭泣', '大笑', '打喷嚏',
  '眼镜', '雨伞', '手表', '书包', '剪刀', '锤子', '吉他', '钢琴',
  '面条', '奶茶', '饺子', '粽子', '寿司', '巧克力', '棒棒糖', '面包',
  '企鹅', '海豚', '蜗牛', '蜜蜂', '老虎', '大象', '孔雀', '鹦鹉',
  '流星', '火山', '瀑布', '沙漠', '灯塔', '城堡', '风车', '帐篷',
  '灯笼', '蜡烛', '地图', '指南针', '麦克风', '望远镜', '滑板', '电梯',
  '洗澡', '化妆', '放风筝', '堆沙堡', '浇花', '骑摩托', '坐火车', '看星星',
] as const

const ROUND_SECONDS = 100

export function pickRandomWord(used: Set<string>): string {
  const pool = DRAW_WORDS.filter((w) => !used.has(w))
  const list = pool.length > 0 ? pool : [...DRAW_WORDS]
  return list[Math.floor(Math.random() * list.length)]!
}

export function normalizeGuess(text: string): string {
  return text.replace(/\s+/g, '').trim().toLowerCase()
}

export function isGuessCorrect(guess: string, answer: string): boolean {
  const g = normalizeGuess(guess)
  const a = normalizeGuess(answer)
  if (!g || !a) return false
  return g === a
}

export { ROUND_SECONDS }
