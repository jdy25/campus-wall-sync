@echo off
chcp 65001 >nul
REM ========================================
REM  校园墙 - 本地开发启动脚本（Windows）
REM  自动安装依赖并启动开发模式
REM  使用：双击运行 或 run_local.bat
REM ========================================

echo ========================================
echo   校园墙 - 本地开发模式
echo ========================================

REM 检查 Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 Python，请先安装 Python 3
    pause
    exit /b 1
)

REM 安装依赖
echo [1/2] 安装依赖...
pip install -r requirements.txt -q

REM 检查配置文件
if not exist "config.json" (
    echo [提示] config.json 不存在，从示例文件创建...
    copy config.json.example config.json >nul
    echo [请先编辑 config.json 填写配置]
)

REM 启动开发模式
echo [2/2] 启动开发服务器...
echo.
echo ========================================
echo   http://localhost:5000
echo   密码: admin123
echo ========================================
echo.
python run_dev.py

pause
