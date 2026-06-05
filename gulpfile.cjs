const { execSync } = require('node:child_process')
const { existsSync } = require('node:fs')
const { resolve } = require('node:path')

require('dotenv').config({ path: resolve(__dirname, 'deploy.env') })

const gulp = require('gulp')
const SftpClient = require('ssh2-sftp-client')

/** SFTP 上传暂存目录（ubuntu 可写） */
const STAGE_PATH = (process.env.DEPLOY_STAGE || '/home/ubuntu/_deploy/three-city').trim()

/** Nginx 站点根目录 */
const NGINX_PATH = (process.env.DEPLOY_PATH || '/root/my-project/nginx/html').trim()

/** draw-sync 服务目录 */
const DRAW_SYNC_PATH = (process.env.DRAW_SYNC_PATH || '/home/ubuntu/three-city-sync').trim()

/** Linux 服务器 SFTP 配置 */
const server = {
  host: (process.env.DEPLOY_HOST || '').trim(),
  user: (process.env.DEPLOY_USER || 'ubuntu').trim(),
  pass: (process.env.DEPLOY_PASS || '').trim(),
  port: Number(process.env.DEPLOY_PORT || 22),
  timeout: Number(process.env.DEPLOY_TIMEOUT || 10000000),
}

function run(command) {
  execSync(command, { cwd: __dirname, stdio: 'inherit' })
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

/** Vite 打包（优先 Node 20+，避免系统 Node 14 无法运行 Vite 7） */
function buildOnly(done) {
  const nodeBin = resolveNodeBin()
  console.log(`[deploy] build with ${nodeBin}`)
  run(`"${nodeBin}" ./node_modules/vite/bin/vite.js build`)
  done()
}

/** TypeScript 类型检查 */
function typeCheck(done) {
  run(`"${process.execPath}" ./node_modules/vue-tsc/bin/vue-tsc.js --build`)
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

  const distDir = resolve(__dirname, 'dist')
  if (!existsSync(distDir)) {
    done(new Error('dist/ 不存在，请先执行 gulp build'))
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

/** 上传并重启 draw-sync 服务 */
function deployDrawSync(done) {
  assertServerConfig()

  const localFile = resolve(__dirname, 'server/draw-sync.cjs')
  const setupScript = resolve(__dirname, 'deploy/setup-draw-sync.sh')
  if (!existsSync(localFile)) {
    done(new Error('server/draw-sync.cjs 不存在'))
    return
  }

  const sftp = new SftpClient()

  sftp
    .connect(getSshConfig())
    .then(() => sftp.mkdir(DRAW_SYNC_PATH, true))
    .then(() => sftp.put(localFile, `${DRAW_SYNC_PATH}/draw-sync.cjs`))
    .then(() => {
      if (existsSync(setupScript)) {
        return sftp.put(setupScript, `${DRAW_SYNC_PATH}/setup-draw-sync.sh`)
      }
    })
    .then(() => sftp.end())
    .then(() =>
      withSshClient((conn) =>
        execRemote(
          conn,
          [
            `chmod +x '${DRAW_SYNC_PATH}/setup-draw-sync.sh' 2>/dev/null || true`,
            `command -v node >/dev/null 2>&1 || (curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs)`,
            `command -v pm2 >/dev/null 2>&1 || sudo npm install -g pm2`,
            `fuser -k 8787/tcp >/dev/null 2>&1 || true`,
            `pm2 delete draw-sync >/dev/null 2>&1 || true`,
            `cd '${DRAW_SYNC_PATH}' && DRAW_SYNC_PORT=8787 pm2 start draw-sync.cjs --name draw-sync`,
            `pm2 save >/dev/null 2>&1 || true`,
            `sleep 1 && curl -sf http://127.0.0.1:8787/api/draw/123456 -H 'X-Draw-Role: guest' >/dev/null && echo '[deploy] draw-sync 健康检查通过' || echo '[deploy] 警告: draw-sync 未响应，请在服务器执行 bash ${DRAW_SYNC_PATH}/setup-draw-sync.sh'`,
          ].join(' && '),
        ),
      ),
    )
    .then(() => {
      console.log(`[deploy] draw-sync 已部署: ${DRAW_SYNC_PATH}`)
      console.log('[deploy] 请确认 Nginx 已配置 /api/draw 反代，参考 deploy/nginx-draw-sync.conf')
      done()
    })
    .catch((err) => {
      sftp.end().finally(() => done(err))
    })
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
gulp.task('deploy-draw-sync', deployDrawSync)
/** 生产默认：仅静态前端（API 由 Java 提供，见 docs/java-backend-deploy.md） */
gulp.task('deploy', gulp.series('build-only', 'prepare-remote', 'upload-dev', 'sync-release'))
gulp.task('default', gulp.series('deploy'))
