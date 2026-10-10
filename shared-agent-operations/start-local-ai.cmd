@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 20 or newer from https://nodejs.org/ and reopen this window.
  pause
  exit /b 1
)
node -e "if(Number(process.versions.node.split('.')[0]) < 20) process.exit(1)"
if errorlevel 1 (
  echo Node.js 20 or newer is required.
  pause
  exit /b 1
)
where ollama >nul 2>nul
if errorlevel 1 (
  echo Ollama is not on PATH. Reopen this window after installing Ollama.
  echo You can run node server.mjs for the scripted demo instead.
  pause
  exit /b 1
)
set "ORBIT_OLLAMA_ENABLED=true"
set "ORBIT_OLLAMA_MODEL=llama3.2"
echo Starting Orbit with optional local AI. Keep this window open.
echo Ollama must be running with llama3.2 downloaded. Nothing sends automatically.
start "" /b powershell -NoProfile -Command "$limit=(Get-Date).AddSeconds(20); while((Get-Date) -lt $limit) { try { $status=Invoke-RestMethod -Uri 'http://127.0.0.1:4317/api/reply-generation/status' -TimeoutSec 1; if($status.enabled -eq $true) { Start-Process 'http://127.0.0.1:4317/'; exit } } catch {}; Start-Sleep -Milliseconds 300 }; Write-Host 'Open http://127.0.0.1:4317 manually if Orbit has started.'"
node server.mjs
pause
endlocal
