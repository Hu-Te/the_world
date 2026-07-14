/**
 * PostCSS：H5 / 全分辨率适配
 * - postcss-mobile-forever：px → vw，桌面端用 maxDisplayWidth 限宽居中（max-vw-mode）
 * - autoprefixer：移动端 WebKit / 各厂商前缀
 *
 * 设计稿基准：375（常见 H5）；不转换请加类名 `.ignore-vw` 或写 `Px`/`PX`。
 * Tailwind 默认为 rem，一般不受 px→vw 影响。
 */
export default {
  plugins: {
    'postcss-mobile-forever': {
      viewportWidth: 375,
      /** 宽屏上限：工具站需保留桌面可读宽度，超限后停止放大并居中 */
      maxDisplayWidth: 1440,
      appSelector: '#__nuxt',
      appContainingBlock: 'auto',
      necessarySelectorWhenAuto: 'body',
      unitPrecision: 5,
      selectorBlackList: ['.ignore-vw', '.hairline'],
      valueBlackList: ['1px', '0.5px'],
      minPixelValue: 1,
      exclude: [/node_modules/i],
      border: false,
    },
    autoprefixer: {},
  },
}
