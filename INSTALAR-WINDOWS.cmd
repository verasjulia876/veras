@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Instale o Node.js LTS pelo site https://nodejs.org e abra este arquivo novamente.
 pause
 exit /b 1
)
call npm ci
if errorlevel 1 (
 echo Nao foi possivel baixar as dependencias. Confira a internet e tente novamente.
 pause
 exit /b 1
)
call npm run install:guided
pause
