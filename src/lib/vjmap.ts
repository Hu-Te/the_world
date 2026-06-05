/**
 * vjmap 发布为 UMD/CJS（export =），Vite 需经此 shim 提供 ESM default。
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error vjmap.min.js has no ESM named exports
import vjmap from 'vjmap/dist/vjmap.min.js'

export default vjmap
