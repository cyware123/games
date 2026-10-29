@echo off
setlocal
set "ENROQUE_ROOT=%~dp0"
set "ENROQUE_LAN=0"
powershell.exe -NoProfile -Command "$script=[IO.File]::ReadAllText((Join-Path $env:ENROQUE_ROOT 'servidor.ps1')); & ([scriptblock]::Create($script)) -Root $env:ENROQUE_ROOT"
if errorlevel 1 pause
endlocal
