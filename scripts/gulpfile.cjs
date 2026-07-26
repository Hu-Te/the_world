const { execSync } = require('node:child_process')
const { existsSync } = require('node:fs')
const { resolve } = require('node:path')

/** 仓库根目录（本文件位于 scripts/） */
const ROOT = resolve(__dirname, '..')

require('dotenv').config({ path: resolve(ROOT, 'deploy.env') })

const gulp = require('gulp')
const SftpClient = require('ssh2-sftp-client')

/** SFTP 上传暂存目录（ubuntu 可写） */
const STAGE_PATH = (process.env.DEPLOY_STAGE || '/home/ubuntu/_deploy/three-city').trim()

/** Nginx 站点根目录（须与线上 nginx root 一致） */
const NGINX_PATH = (process.env.DEPLOY_PATH || '/home/ubuntu/_deploy/three-city').trim()

/** Linux 服务器 SFTP 配置 */
const server = {
  host: (process.env.DEPLOY_HOST || '').trim(),
  user: (process.env.DEPLOY_USER || 'ubuntu').trim(),
  pass: (process.env.DEPLOY_PASS || '').trim(),
  port: Number(process.env.DEPLOY_PORT || 22),
  timeout: Number(process.env.DEPLOY_TIMEOUT || 10000000),
}

function run(command) {
  execSync(command, { cwd: ROOT, stdio: 'inherit' })
}

function assertServerConfig() {
  if (!server.host) {
    throw new Error('请在 deploy.env 中设置 DEPLOY_HOST')
  }
  if (!server.pass) {
    throw new Error('请在 deploy.env 中设置 DEPLOY_PASS')
  }
  if (server.user === 'root') {
    console.warn('[deploy] 提示：腾讯云 Ubuntu 镜像通常用 ubuntu 账号，root 密码登录可能失败')
  }
}

function getSshConfig() {
  return {
    host: server.host,
    port: server.port,
    username: server.user,
    password: server.pass,
    readyTimeout: server.timeout,
  }
}

function withSshClient(onReady) {
  return new Promise((resolvePromise, reject) => {
    const { Client } = require('ssh2')
    const conn = new Client()

    conn.on('ready', () => {
      onReady(conn)
        .then(() => {
          conn.end()
          resolvePromise()
        })
        .catch((err) => {
          conn.end()
          reject(err)
        })
    })

    conn.on('error', reject)

    conn.connect(getSshConfig())
  })
}

function execRemote(conn, command) {
  return new Promise((resolvePromise, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) {
        reject(err)
        return
      }

      let stderr = ''
      stream.on('data', () => {})
      stream.stderr.on('data', (chunk) => {
        stderr += chunk.toString()
      })

      stream.on('close', (code) => {
        if (code === 0) {
          resolvePromise()
        } else {
          reject(new Error(stderr.trim() || `远程命令失败，退出码 ${code}`))
        }
      })
    })
  })
}

function mkdirRemote(dir) {
  return withSshClient((conn) => execRemote(conn, `mkdir -p '${dir}'`))
}

function resolveNodeBin() {
  const candidates = [
    process.env.DEPLOY_NODE,
    process.env.NVM_BIN && `${process.env.NVM_BIN}/node`,
    `${process.env.HOME}/.nvm/versions/node/v24.3.0/bin/node`,
    `${process.env.HOME}/.nvm/versions/node/v22.0.0/bin/node`,
    `${process.env.HOME}/.nvm/versions/node/v20.0.0/bin/node`,
    process.execPath,
  ].filter(Boolean)

  for (const bin of candidates) {
    if (existsSync(bin)) return bin
  }
  return process.execPath
}

/** Nuxt generate → .output/public（优先 Node 20+） */
function buildOnly(done) {
  // 禁止把 APP_API_TOKEN 注入 NUXT_PUBLIC_*（会打进浏览器包）
  if (process.env.NUXT_PUBLIC_API_TOKEN) {
    console.warn(
      '[deploy] NUXT_PUBLIC_API_TOKEN 已废弃且有泄露风险，已忽略；工具 API 使用用户 JWT，Agent 使用本机 APP_API_TOKEN',
    )
    delete process.env.NUXT_PUBLIC_API_TOKEN
  }
  const nodeBin = resolveNodeBin()
  console.log(`[deploy] nuxt generate with ${nodeBin}`)
  run(`"${nodeBin}" ./node_modules/nuxt/bin/nuxt.mjs generate`)
  done()
}

/** TypeScript 类型检查 */
function typeCheck(done) {
  run(`"${process.execPath}" ./node_modules/nuxt/bin/nuxt.mjs typecheck`)
  done()
}

/** 创建 SFTP 暂存目录 */
function prepareRemote(done) {
  assertServerConfig()
  mkdirRemote(STAGE_PATH)
    .then(() => {
      console.log(`[deploy] 暂存目录就绪: ${STAGE_PATH}`)
      done()
    })
    .catch(done)
}

/** SFTP 上传到暂存目录（ssh2-sftp-client，兼容 Node 24） */
function uploadDev(done) {
  assertServerConfig()

  const distDir = resolve(ROOT, '.output/public')
  if (!existsSync(distDir)) {
    done(new Error('.output/public 不存在，请先执行 gulp build / nuxt generate'))
    return
  }

  const sftp = new SftpClient()

  sftp
    .connect(getSshConfig())
    .then(() => sftp.uploadDir(distDir, STAGE_PATH))
    .then(() => {
      console.log(`[deploy] 已上传到: ${STAGE_PATH}`)
      return sftp.end()
    })
    .then(() => done())
    .catch((err) => {
      sftp.end().finally(() => done(err))
    })
}

/** 同步到 Nginx 目录 */
function syncRelease(done) {
  assertServerConfig()

  const command = [
    `sudo mkdir -p '${NGINX_PATH}'`,
    `sudo rsync -a --delete '${STAGE_PATH}/' '${NGINX_PATH}/'`,
  ].join(' && ')

  withSshClient((conn) => execRemote(conn, command))
    .then(() => {
      console.log(`[deploy] 已同步到 Nginx 目录: ${NGINX_PATH}`)
      done()
    })
    .catch(done)
}

/** 测试 SFTP 账号 */
function testAuth(done) {
  assertServerConfig()

  withSshClient(() => Promise.resolve())
    .then(() => {
      console.log(`[deploy] 认证成功: ${server.user}@${server.host}`)
      done()
    })
    .catch((err) => done(new Error(`认证失败: ${err.message}（腾讯云请用 ubuntu 账号）`)))
}

gulp.task('test-auth', testAuth)
gulp.task('build-only', buildOnly)
gulp.task('type-check', typeCheck)
gulp.task('build', gulp.series('type-check', 'build-only'))
gulp.task('prepare-remote', prepareRemote)
gulp.task('upload-dev', uploadDev)
gulp.task('sync-release', syncRelease)
/** 生产默认：Nuxt 静态前端（API 由 Java 提供，Nginx /api 反代） */
gulp.task('deploy', gulp.series('build-only', 'prepare-remote', 'upload-dev', 'sync-release'))
gulp.task('default', gulp.series('deploy'))
