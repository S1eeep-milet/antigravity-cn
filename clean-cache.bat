@echo off
chcp 65001 >nul
title Antigravity 缓存清理

echo ============================================================
echo          Antigravity 缓存清理工具
echo ============================================================
echo.

node "%~dp0scripts\clean-cache.js" %*

if %ERRORLEVEL% equ 0 (
    echo.
    echo 缓存清理完成。登录态与个人设置未受影响。
) else (
    echo.
    echo 清理未完成，请检查上方提示（客户端运行时请先关闭或加 --force）。
)

echo.
pause