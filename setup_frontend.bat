@echo off
cd /d "%~dp0"

echo ======================================
echo Configurando FRONTEND...
echo ======================================

cd frontend

echo Instalando dependencias de Node...
npm install

echo.
echo ======================================
echo FRONTEND listo.
echo Para iniciarlo usa:
echo npm run dev
echo ======================================

pause