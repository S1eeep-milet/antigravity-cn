@echo off
chcp 65001 >nul
title Antigravity 词典审计

echo ============================================================
echo          Antigravity 词典审计工具
echo ============================================================
echo.

node "%~dp0scripts\audit-dict.js" %*

echo.
pause