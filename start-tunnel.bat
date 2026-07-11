@echo off
chcp 65001 >nul
setlocal
set "NODE=C:\Users\dell\.workbuddy\binaries\node\versions\22.22.2\node.exe"
set "DIR=%~dp0"
set "PORT=3001"
set "CFG=%DIR%cloudflared\config.yml"

title 济南管家 - 后端+固定隧道

REM ---------- 0) 环境自检 ----------
where cloudflared >nul 2>&1
if errorlevel 1 (
  echo [!] 未检测到 cloudflared，请先安装：
  echo.
  echo     方式A（推荐）：winget install --id Cloudflare.cloudflared
  echo     方式B：到 https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/ 下载 Windows 版
  echo.
  echo 安装后，首次需执行一次：
  echo     cloudflared login
  echo     cloudflared tunnel create jinan-butler
  echo 并把 cloudflared\config.yml 里的 ^<TUNNEL_ID^> 替换成创建得到的 UUID。
  echo.
  pause
  exit /b 1
)

if not exist "%NODE%" (
  echo [!] 未找到 node：%NODE%
  echo     请确认 WorkBuddy 的 node 路径，或修改本脚本 NODE 变量。
  pause
  exit /b 1
)

REM ---------- 1) 启动后端 server.js（后台窗口） ----------
echo [*] 启动后端 server.js (端口 %PORT%) ...
start "JinanButler-Server" "%NODE%" "%DIR%server.js"

REM ---------- 2) 启动 cloudflared 固定隧道（前台，保持此窗口打开） ----------
echo [*] 启动 cloudflared 固定隧道 ...
echo     若提示 tunnel not found，请先执行：cloudflared tunnel create jinan-butler
echo     并把 config.yml 的 ^<TUNNEL_ID^> 替换为实际 UUID。
echo.
cloudflared tunnel --config "%CFG%" run

REM 隧道退出后提示
echo [!] 隧道已停止。按任意键关闭本窗口。
pause
endlocal
