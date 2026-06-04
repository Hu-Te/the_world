'use strict'

const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const DEFAULT_TIMEOUT_MS = Number(process.env.CAD_CONVERT_TIMEOUT_MS || 180000)

/**
 * ODA File Converter：输入/输出均为目录，将目录内 DWG 转为 DXF。
 * @see https://www.opendesign.com/guestfiles/oda_file_converter
 */
function runOdaConverter(inputDir, outputDir, options) {
  const bin = process.env.ODA_CONVERTER_BIN
  if (!bin) {
    return Promise.reject(new Error('未配置 ODA_CONVERTER_BIN，无法转换 DWG'))
  }

  const version = options?.version || process.env.ODA_OUTPUT_VERSION || 'ACAD2013'
  const format = options?.format || 'DXF'
  const recurse = options?.recurse ?? '0'
  const audit = options?.audit ?? '1'
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS

  return new Promise(function (resolve, reject) {
    const args = [inputDir, outputDir, version, format, recurse, audit]
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    let stdout = ''

    const timer = setTimeout(function () {
      child.kill('SIGKILL')
      reject(new Error('转换超时（' + Math.round(timeoutMs / 1000) + 's）'))
    }, timeoutMs)

    child.stdout.on('data', function (chunk) {
      stdout += chunk
    })
    child.stderr.on('data', function (chunk) {
      stderr += chunk
    })

    child.on('error', function (err) {
      clearTimeout(timer)
      reject(new Error('无法启动 ODA：' + err.message))
    })

    child.on('close', function (code) {
      clearTimeout(timer)
      if (code === 0) {
        resolve({ stdout: stdout, stderr: stderr })
        return
      }
      const detail = (stderr || stdout || '').trim().slice(0, 400)
      reject(new Error('ODA 转换失败（退出码 ' + code + '）' + (detail ? '：' + detail : '')))
    })
  })
}

function findFirstDxf(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const nested = findFirstDxf(full)
      if (nested) return nested
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.dxf')) {
      return full
    }
  }
  return null
}

function isOdaConfigured() {
  const bin = process.env.ODA_CONVERTER_BIN
  if (!bin) return false
  try {
    return fs.existsSync(bin)
  } catch {
    return false
  }
}

/**
 * 将单个 DWG 文件转换为 DXF，返回 DXF 绝对路径。
 */
async function convertDwgFileToDxf(dwgPath, workDir) {
  const inputDir = path.join(workDir, 'in')
  const outputDir = path.join(workDir, 'out')
  fs.mkdirSync(inputDir, { recursive: true })
  fs.mkdirSync(outputDir, { recursive: true })

  const baseName = path.basename(dwgPath)
  fs.copyFileSync(dwgPath, path.join(inputDir, baseName))

  await runOdaConverter(inputDir, outputDir)

  const dxfPath = findFirstDxf(outputDir)
  if (!dxfPath) {
    throw new Error('转换完成但未找到 DXF 输出文件')
  }
  return dxfPath
}

module.exports = {
  isOdaConfigured,
  convertDwgFileToDxf,
  runOdaConverter,
}
