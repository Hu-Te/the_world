# 部署说明

## 前端（Nuxt 3 静态站）

| 路径                        | 说明                          |
| --------------------------- | ----------------------------- |
| `../deploy.env.example`     | 复制为仓库根目录 `deploy.env` |
| `../scripts/gulpfile.cjs`   | `npm run deploy`              |
| `nginx-hute-top.conf`       | hute.top 完整站点             |
| `nginx-java-api.conf`       | `/api/` 反代片段              |
| `nginx-three-city.conf`     | 历史 IP 站配置参考            |
| `../scripts/deploy.sh`      | rsync 备选                    |
| `../scripts/server-init.sh` | 服务器首次装 Nginx            |

```bash
cp deploy.env.example deploy.env
npm install
npm run check                      # 可选：提交前检查
npm run deploy                     # generate + SFTP + 同步 Nginx
```

## 后端（../myweb_JAVA）

| 脚本                              | 说明                      |
| --------------------------------- | ------------------------- |
| `scripts/deploy-jar.cjs`          | 上传 JAR 并重启 `website` |
| `scripts/deploy-ssl.cjs`          | SSL + Nginx               |
| `scripts/harden-server-ports.cjs` | 防火墙                    |
| `scripts/remote-check.cjs`        | 远程巡检                  |

## 服务器约定

- 静态：`DEPLOY_STAGE` → `DEPLOY_PATH`
- API：`127.0.0.1:8787`
- 域名：`hute.top`
