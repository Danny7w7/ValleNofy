@echo off
setlocal EnableExtensions
chcp 65001 >nul
set "PYTHONUTF8=1"
cd /d "%~dp0"
title ValleNofy - Que suene el vallenato
echo.
echo   ValleNofy - Vallenato hasta 2013
echo   Preparando la parranda en este proyecto...
echo.

if exist "venv\Scripts\python.exe" goto entorno_listo

where py >nul 2>nul
if errorlevel 1 goto usar_python
py -3 -m venv venv
if errorlevel 1 goto error_entorno
goto entorno_listo

:usar_python
where python >nul 2>nul
if errorlevel 1 goto falta_python
python -m venv venv
if errorlevel 1 goto error_entorno

:entorno_listo
"%~dp0venv\Scripts\python.exe" "%~dp0scripts\bootstrap.py" %*
if errorlevel 1 goto error_inicio
exit /b 0

:falta_python
echo Falta Python. Instala Python 3.12, 3.13 o 3.14 de 64 bits y agregalo al PATH.
echo Instrucciones y enlace oficial en readme.md.
goto fallo

:error_entorno
echo No se pudo preparar venv. Revisa la instalacion de Python y readme.md.
goto fallo

:error_inicio
echo.
echo ValleNofy no pudo completar el inicio. El motivo aparece arriba.
echo Revisa la seccion de problemas comunes de readme.md.

:fallo
echo.
pause
exit /b 1
