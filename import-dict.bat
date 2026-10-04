@echo off
chcp 65001 >nul
title Antigravity 词典扩充

echo ============================================================
echo          Antigravity 词典扩充工具
echo ============================================================
echo.

if "%~1"=="" (
    echo 用法：把外部词典文件或目录拖到本脚本上，或命令行传入路径
    echo   import-dict.bat "D:\dict\zh-CN"
    echo   import-dict.bat "D:\dict\extra.json" --dry-run
    echo.
    pause
    exit /b 1
)

node "%~dp0scripts\import-dict.js" %*

echo.
pause