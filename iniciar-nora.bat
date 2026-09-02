@echo off
title Nora - Tu Asistente Personal
cd /d "%~dp0"
start "Nora Server" cmd /k "npm start"
timeout /t 3 /nobreak >nul
start "" "http://localhost:3000"
