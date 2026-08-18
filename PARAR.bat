@echo off
chcp 65001 >nul
title Nossa Rede - desligando
cd /d "%~dp0"

echo.
echo   Desligando a rede...
echo.

docker compose -f infra/docker-compose.yml --env-file .env down

echo.
echo   A rede esta desligada. Nada foi apagado - suas mensagens,
echo   fotos e conversas continuam guardadas.
echo.
echo   Para ligar de novo:  INICIAR.bat
echo.
timeout /t 10
