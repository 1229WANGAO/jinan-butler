@echo off
chcp 65001 >nul
title 推送到 GitHub - 济南管家工作台
cd /d "%~dp0"

set "GIT=C:\Users\dell\.workbuddy\vendor\PortableGit\mingw64\bin\git.exe"

echo ============================================
echo   济南管家工作台 - 推送到 GitHub
echo   仓库: https://github.com/1229WANGAO/jinan-butler
echo ============================================
echo.
echo 接下来会要求你输入两样东西:
echo   Username : 1229WANGAO
echo   Password : 粘贴你的“个人访问令牌(Token)”, 不是 GitHub 登录密码!
echo.
echo   (令牌怎么拿: GitHub 右上头像 - Settings - Developer settings
echo    - Personal access tokens - Tokens(classic) - Generate new token
echo    - 勾选 repo 权限 - 生成后复制那串 ghp_ 开头的字符)
echo.
echo   提示: 粘贴令牌时屏幕不显示任何字符是正常的, 粘贴后直接回车。
echo.
pause

"%GIT%" branch -M main
"%GIT%" -c credential.helper= push -u origin main

if errorlevel 1 (
  echo.
  echo [!] 推送失败。常见原因：
  echo   1) 令牌输错或没勾 repo 权限 -^> 重新生成令牌再双击本文件。
  echo   2) 用户名不是 1229WANGAO。
  echo   3) 令牌当密码, 不要输 GitHub 登录密码。
  echo.
  pause
  exit /b 1
)

echo.
echo [OK] 推送成功！去 Render 部署:
echo   https://render.com  -^> New -^> Blueprint -^> 选 jinan-butler 仓库
echo.
pause