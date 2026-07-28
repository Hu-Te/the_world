# 财务审计桌面壳（Tauri 2 + Rust）

同账号登录云端 IAM；业务数据仅本机 `~/.hute/finance/{tenantId}/`。

## 目录

```
apps/finance-desktop/
  www/              # 前端静态页（Tauri frontendDist）
  src-tauri/        # Rust / Tauri 2
  package.json      # @tauri-apps/cli
```

## 本机开发

```bash
# 依赖：Rust stable + Node ≥20 + Xcode CLT
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cd apps/finance-desktop
npm install
npm run dev          # tauri dev
npm run build        # 产出 .app → src-tauri/target/release/bundle/macos/
```

联调 Sidecar（另开终端，在 myweb_JAVA）：

```bash
make desktop-finance-run TENANT=<云端tenantId>
```

## 云端分发

```bash
# myweb_JAVA：优先 Tauri 构建，再打 dmg 写入 jar 资源
make finance-desktop
```

产物：`adapter-web/.../finance-desktop/finance-desktop-macos.dmg`

## 说明

- 框架期未 Apple 公证：首次打开需右键 → 打开，或 `xattr -cr`
- Windows：当前仍为便携 zip（内含启动器）；Tauri Windows 包需在 Windows 主机 `tauri build`
