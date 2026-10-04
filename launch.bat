@echo off
chcp 65001 >nul
title Antigravity 启动

node "%~dp0scripts\launch.js" %*

if %ERRORLEVEL% neq 0 (
    echo.
    echo 启动失败，请检查上方日志。
    pause
)
