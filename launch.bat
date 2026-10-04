@echo off
chcp 65001 >nul
title Antigravity 一键启动

echo ============================================================
echo          Antigravity 一键启动
echo ============================================================
echo.

node "%~dp0scripts\launch.js" %*

if %ERRORLEVEL% neq 0 (
    echo.
    echo 启动失败，可用 --list 查看探测到的安装目录。
)

echo.
pause