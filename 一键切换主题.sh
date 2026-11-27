#!/usr/bin/env bash
# Ghostty 一键切换主题脚本（自动镜像壁纸/着色器到 ~/.config/ghostty/assets/，无权限问题）
# 用法：bash ./一键切换主题.sh

set -euo pipefail

THEME_ROOT="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="$(command -v node || ls "${HOME}/.nvm/versions/node/"*/bin/node 2>/dev/null | tail -n 1 || echo /usr/local/bin/node)"

CATEGORIES=("特效着色器" "自动切换深浅色" "磨砂与液态玻璃" "背景图氛围" "深色经典" "浅色护眼" "我的自定义")
FILES=()
LABELS=()

echo ""
echo "=========================================="
echo "      Ghostty 精选主题一键切换工具"
echo "=========================================="

idx=1
for cat in "${CATEGORIES[@]}"; do
  dir="${THEME_ROOT}/${cat}"
  [ -d "$dir" ] || continue
  files_in_cat=("$dir"/*.conf)
  [ -e "${files_in_cat[0]}" ] || continue
  echo ""
  echo "【${cat}】"
  for f in "${files_in_cat[@]}"; do
    [ -f "$f" ] || continue
    name="$(basename "$f" .conf)"
    printf "  %2d) %s\n" "$idx" "$name"
    FILES+=("$f")
    LABELS+=("${cat} / ${name}")
    idx=$((idx + 1))
  done
done

echo ""
read -r -p "请输入要切换的主题编号 (1-$((idx - 1))，回车取消): " choice
if [ -z "${choice:-}" ]; then
  echo "已取消。"
  exit 0
fi

if ! [[ "$choice" =~ ^[0-9]+$ ]] || [ "$choice" -lt 1 ] || [ "$choice" -ge "$idx" ]; then
  echo "无效编号：$choice"
  exit 1
fi

SELECTED_FILE="${FILES[$((choice - 1))]}"
SELECTED_LABEL="${LABELS[$((choice - 1))]}"

"$NODE_BIN" "${THEME_ROOT}/studio-server.mjs" --apply "$SELECTED_FILE" "$SELECTED_LABEL"
echo "📄 已更新：${HOME}/.config/ghostty/config"
echo "⚡️ 请在 Ghostty 窗口按 Cmd + Shift + , 热重载生效（如换了液态玻璃或新壁纸可重启 Ghostty）。"
echo ""
