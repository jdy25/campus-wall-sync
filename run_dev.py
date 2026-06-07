"""
开发模式启动脚本

直接启动 Flask，自动检测 frontend/ 目录是否存在。
存在 → 开发模式（Flask 托管前端，http://localhost:5000 全功能可用）
不存在 → 生产模式（仅 API，需 Nginx 反代）

使用方式：
    python run_dev.py

如需强制关闭前端托管（即使 frontend/ 存在）：
    DISABLE_DEV_FRONTEND=1 python run_dev.py
"""

import os
import sys

# 确保能从项目根目录导入 src
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 检查前端目录
frontend_index = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend", "index.html")
disable_dev = os.environ.get("DISABLE_DEV_FRONTEND", "").strip() in ("1", "true", "yes")

if os.path.isfile(frontend_index) and not disable_dev:
    print()
    print("=" * 60)
    print("  🌐 校园墙 - 开发模式")
    print("  Flask 同时提供 API 和前端页面")
    print("=" * 60)
else:
    print()
    print("=" * 60)
    print("  🌐 校园墙 - 生产模式")
    print("  仅提供 API 服务，前端需 Nginx 托管")
    print("=" * 60)

# 启动 Flask
from src.app import main
main()
