@echo off
chcp 65001 >nul
title Nossa Rede - ligando
cd /d "%~dp0"

echo.
echo   ╭────────────────────────────────────────────────╮
echo   │             Ligando a Nossa Rede               │
echo   ╰────────────────────────────────────────────────╯
echo.

REM ─── O Docker precisa estar de pé antes de qualquer coisa ────────────
docker info >nul 2>&1
if errorlevel 1 (
    echo   O Docker Desktop nao esta rodando.
    echo.
    echo   Abra o Docker Desktop pelo menu Iniciar e espere o icone da
    echo   baleia, no canto da barra de tarefas, ficar verde. Depois
    echo   clique neste arquivo de novo.
    echo.
    echo   Na primeira vez do dia isso pode levar um ou dois minutos.
    echo.
    pause
    exit /b 1
)

REM ─── Primeira vez? Prepara a configuracao ────────────────────────────
if not exist ".env" (
    echo   Primeira vez por aqui. Preparando a configuracao...
    echo.
    call pnpm preparar
    echo.
    echo   Leia as instrucoes acima antes de continuar.
    echo.
    pause
    exit /b 0
)

echo   Subindo a rede...
echo   ^(na primeira vez demora alguns minutos - o Docker monta tudo^)
echo.

docker compose -f infra/docker-compose.yml --env-file .env up -d --build
if errorlevel 1 (
    echo.
    echo   Algo deu errado. Para descobrir o que, rode:
    echo.
    echo       pnpm doutor
    echo.
    pause
    exit /b 1
)

echo.
echo   Pronto. A rede esta no ar.
echo.

REM Mostra o endereco para abrir no celular.
for /f "tokens=2 delims==" %%d in ('findstr /b "DOMINIO=" .env') do set DOMINIO=%%d
if defined DOMINIO (
    echo   No celular, abra:  https://%DOMINIO%
    echo.
    echo   ^(o Tailscale precisa estar conectado no celular tambem^)
    echo.
)

echo   Para conferir se esta tudo certo:  DIAGNOSTICO.bat
echo   Para desligar:                     PARAR.bat
echo.
timeout /t 20
