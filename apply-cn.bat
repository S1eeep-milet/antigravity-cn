@echo off
chcp 65001 >nul
title Antigravity 界面中文化安装程序

echo ============================================================
echo          Antigravity 界面中文本地化安装程序
echo ============================================================
echo.

node "%~dp0scripts\patch.js"

if %ERRORLEVEL% equ 0 (
    echo.
    echo 汉化改造已成功完成！请重新启动 Antigravity 体验中文界面。
) else (
    echo.
    echo 汉化过程出现错误，请检查上方日志。
)

echo.
pause
