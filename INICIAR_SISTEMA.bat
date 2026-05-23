@echo off
title Saulo Fitness - Sistema de Telemetria
color 0A

echo =======================================================
echo          INICIANDO SISTEMA SAULO FITNESS...
echo =======================================================
echo.
echo [1/3] Iniciando o Banco de Dados e Servidor (Backend)...
start "Backend - Saulo Fitness" cmd /c "cd backend && node server.js"

echo [2/3] Iniciando a Interface Visual (Frontend)...
start "Frontend - Saulo Fitness" cmd /c "cd frontend && npm run dev"

echo.
echo Aguardando o motor do sistema aquecer...
timeout /t 5 /nobreak > NUL

echo [3/3] Abrindo o navegador...
:: Como vi que vc usa Vite (vite.config.js), a porta padrao e 5173
start http://localhost:5173

echo.
echo =======================================================
echo    SISTEMA RODANDO! BORA GRAVAR!
echo =======================================================
echo.
echo Pode minimizar ou fechar esta janela preta.
pause > NUL