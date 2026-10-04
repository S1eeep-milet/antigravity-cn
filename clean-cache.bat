@echo off
chcp 65001 >nul
title Antigravity 清理缓存

echo ============================================================
echo          Antigravity 缓存清理工具
echo   仅清理临时渲染/编译缓存，不影响配置与登录状态
echo ============================================================
echo.

node "%~dp0scripts\clean-cache.js" %*

if %ERRORLEVEL% equ 0 (
    echo.
    echo 缓存清理完成！请重新启动 Antigravity。
) else (
    echo.
    echo 缓存清理出现错误，请检查上方日志。
)

echo.
pause
