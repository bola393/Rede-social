@echo off
chcp 65001 >nul
title Nossa Rede - diagnostico
cd /d "%~dp0"

call pnpm doutor

echo.
echo   ────────────────────────────────────────────────────────
echo   Nao entendeu algum termo?  docs\glossario.md
echo   Problema especifico?       docs\o-que-fazer-se.md
echo.
pause
