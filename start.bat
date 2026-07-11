@echo off
chcp 65001 >nul
cd /d "%~dp0"

REM 检查 node 是否在 PATH
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [错误] 未检测到 Node.js，请先安装：https://nodejs.org （选 LTS 版本）
  echo 安装后重新双击本文件即可。
  pause
  exit /b 1
)

echo ========================================
echo   济南管家 · 企业微信后端 启动中
echo   浏览器访问： http://localhost:3001
echo   工作台密码： 000000
echo   按 Ctrl + C 停止服务
echo ========================================
echo.
node server.js
pause
