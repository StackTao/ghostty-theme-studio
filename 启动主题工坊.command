#!/usr/bin/env bash
# 双击即可启动 Ghostty 可视化主题预览与自由定制工坊！
THEME_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$THEME_ROOT" || exit 1

NODE_BIN="$(command -v node || ls "${HOME}/.nvm/versions/node/"*/bin/node 2>/dev/null | tail -n 1 || echo /usr/local/bin/node)"

if ! lsof -i :3847 >/dev/null 2>&1; then
  "$NODE_BIN" "${THEME_ROOT}/studio-server.mjs" &
  SERVER_PID=$!
  sleep 0.6
  open "http://127.0.0.1:3847"
  echo "✨ Ghostty 主题工坊已在浏览器打开：http://127.0.0.1:3847"
  echo "按 Ctrl + C 可关闭本地预览服务。"
  wait "$SERVER_PID"
else
  open "http://127.0.0.1:3847"
  echo "✨ Ghostty 主题工坊已在运行，已为你打开页面：http://127.0.0.1:3847"
fi
