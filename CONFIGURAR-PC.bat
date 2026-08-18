@echo off
chcp 65001 >nul
title Nossa Rede - preparar o PC
cd /d "%~dp0"

REM Este script mexe em configuracoes do Windows, entao precisa de permissao
REM de administrador. Se voce nao abriu como administrador, ele pede aqui.
net session >nul 2>&1
if errorlevel 1 (
    echo.
    echo   Pedindo permissao de administrador...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\configurar-pc.ps1"
