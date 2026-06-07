#!/bin/bash
# ========================================
# 校园墙 - 本地开发启动脚本（Linux/Mac）
# 使用：chmod +x run_local.sh && ./run_local.sh
# ========================================

set -e

echo "========================================"
echo "  校园墙 - 本地开发模式"
echo "========================================"

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo "[错误] 未找到 Python3"
    exit 1
fi

# 安装依赖
echo "[1/2] 安装依赖..."
pip3 install -r requirements.txt -q

# 检查配置文件
if [ ! -f "config.json" ]; then
    echo "[提示] config.json 不存在，从示例文件创建..."
    cp config.json.example config.json
    echo "[请先编辑 config.json 填写配置]"
fi

# 启动开发模式
echo "[2/2] 启动开发服务器..."
echo ""
echo "========================================"
echo "  http://localhost:5000"
echo "  密码: admin123"
echo "========================================"
echo ""

python3 run_dev.py
