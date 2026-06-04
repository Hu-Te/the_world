'use strict'

const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const os = require('os')
const path = require('path')
const { URL } = require('url')
const { convertDwgFileToDxf, isOdaConfigured } = require('./lib/oda-convert.cjs')

const PORT = Number(process.env.CAD_CONVERT_PORT || 8788)
const MAX_BYTES = Number(process.env.CAD_CONVERT_MAX_BYTES || 50 * 1024 * 1024)

function json(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(JSON.stringify(data))
}

function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-File-Name')
}

function readRawBody(req, limit) {
  return new Promise(function (resolve, reject) {
    const chunks = []
    let size = 0
    req.on('data', function (chunk) {
      size += chunk.length
      if (size > limit) {
        reject(new Error('文件超过大小上限'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', function () {
      resolve(Buffer.concat(chunks))
    })
    req.on('error', reject)
  })
}

function rmDirSafe(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true })
  } catch {
    /* ignore */
  }
}

function safeBaseName(name) {
  const base = path.basename(String(name || 'drawing.dwg'))
  return base.replace(/[^\w.\-()\u4e00-\u9fff]/g, '_') || 'drawing.dwg'
}

async function handleConvert(req, res) {
  if (!isOdaConfigured()) {
    json(res, 503, {
      error: 'CAD 转换服务未就绪',
      hint: '请在服务器安装 ODA File Converter 并设置环境变量 ODA_CONVERTER_BIN',
    })
    return
  }

  const fileName = safeBaseName(req.headers['x-file-name'])
  if (!fileName.toLowerCase().endsWith('.dwg')) {
    json(res, 400, { error: '仅支持 .dwg 文件' })
    return
  }

  let body
  try {
    body = await readRawBody(req, MAX_BYTES)
  } catch (err) {
    json(res, 400, { error: err.message || '读取请求失败' })
    return
  }

  if (!body.length) {
    json(res, 400, { error: '空文件' })
    return
  }

  const workDir = path.join(os.tmpdir(), 'cad-convert-' + crypto.randomUUID())
  const dwgPath = path.join(workDir, fileName)

  try {
    fs.mkdirSync(workDir, { recursive: true })
    fs.writeFileSync(dwgPath, body)

    const dxfPath = await convertDwgFileToDxf(dwgPath, workDir)
    const outName = fileName.replace(/\.dwg$/i, '.dxf')
    const dxfBuffer = fs.readFileSync(dxfPath)

    res.writeHead(200, {
      'Content-Type': 'application/dxf',
      'Content-Disposition': 'inline; filename="' + encodeURIComponent(outName) + '"',
      'Cache-Control': 'no-store',
      'X-Converted-From': 'dwg',
    })
    res.end(dxfBuffer)
  } catch (err) {
    json(res, 500, { error: err.message || '转换失败' })
  } finally {
    rmDirSafe(workDir)
  }
}

const server = http.createServer(function (req, res) {
  cors(req, res)

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  let url
  try {
    url = new URL(req.url || '/', 'http://' + (req.headers.host || 'localhost'))
  } catch {
    json(res, 400, { error: 'bad url' })
    return
  }

  if (url.pathname === '/api/cad/health' && req.method === 'GET') {
    json(res, 200, {
      ok: true,
      oda: isOdaConfigured(),
      maxBytes: MAX_BYTES,
    })
    return
  }

  if (url.pathname === '/api/cad/convert' && req.method === 'POST') {
    void handleConvert(req, res)
    return
  }

  json(res, 404, { error: 'not found' })
})

server.on('error', function (err) {
  if (err.code === 'EADDRINUSE') {
    console.error('[cad-convert] 端口 ' + PORT + ' 已被占用')
  } else {
    console.error('[cad-convert] 启动失败:', err.message)
  }
  process.exit(1)
})

server.listen(PORT, '0.0.0.0', function () {
  console.log('[cad-convert] http://0.0.0.0:' + PORT)
  console.log('[cad-convert] ODA:', isOdaConfigured() ? '已配置' : '未配置（设置 ODA_CONVERTER_BIN）')
})
