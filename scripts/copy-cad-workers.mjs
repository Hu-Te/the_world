import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public/assets')

const workers = [
  {
    from: join(root, 'node_modules/@mlightcad/data-model/dist/dxf-parser-worker.js'),
    to: 'dxf-parser-worker.js',
  },
  {
    from: join(root, 'node_modules/@mlightcad/cad-simple-viewer/dist/libredwg-parser-worker.js'),
    to: 'libredwg-parser-worker.js',
  },
  {
    from: join(root, 'node_modules/@mlightcad/cad-simple-viewer/dist/mtext-renderer-worker.js'),
    to: 'mtext-renderer-worker.js',
  },
]

await mkdir(outDir, { recursive: true })

for (const worker of workers) {
  await copyFile(worker.from, join(outDir, worker.to))
  console.log(`[copy-cad-workers] ${worker.to}`)
}
