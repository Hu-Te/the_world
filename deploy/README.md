# 部署说明

## 前端（Nuxt 3 静态站）

| 路径                      | 说明                          |
| ------------------------- | ----------------------------- |
| `../deploy.env.example`   | 复制为仓库根目录 `deploy.env` |
| `../scripts/gulpfile.cjs` | `npm run deploy`              |
| `nginx-hute-top.conf`     | hute.top HTTPS + `/api` 反代  |

```bash
cp deploy.env.example deploy.env
npm install
npm run deploy                     # generate + SFTP + 同步 Nginx
```

现网 Nginx `root` 与 `DEPLOY_PATH` / `DEPLOY_STAGE` 均为：
`/home/ubuntu/_deploy/three-city`

## 后端（../myweb_JAVA）

| 脚本                              | 说明                      |
| --------------------------------- | ------------------------- |
| `scripts/deploy-jar.cjs`          | 上传 JAR 并重启 `website` |
| `scripts/deploy-ssl.cjs`          | SSL + Nginx               |
| `scripts/harden-server-ports.cjs` | 防火墙                    |
| `scripts/remote-check.cjs`        | 远程巡检                  |

```bash
make deploy   # package + deploy-jar
```

## 服务器约定

- 静态：`/home/ubuntu/_deploy/three-city`
- API：`127.0.0.1:8787`（systemd：`website`）
- 配置：`/home/ubuntu/website/website.env`
- JDK：`/home/ubuntu/jdk/jdk-25`
- 域名：`hute.top`
