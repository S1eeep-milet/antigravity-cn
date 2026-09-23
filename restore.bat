@echo off
chcp 65001 >nul
title Antigravity 恢复官方英文原版

echo ============================================================
echo          Antigravity 恢复官方英文原版程序
echo ============================================================
echo.

node "%~dp0scripts\restore.js"

if %ERRORLEVEL% equ 0 (
    echo.
    echo 官方原版已恢复成功！请重新启动 Antigravity。
) else (
    echo.
    echo 还原过程出现错误，请检查备份文件是否存在。
)

echo.
pause
