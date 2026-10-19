@echo off
cd /d "C:\Users\LOUKA\lkz-discord-bot"
where node >nul 2>&1 || exit /b 1
call npx --yes pm2 resurrect >nul 2>&1
call npx --yes pm2 describe lkz-discord-bot >nul 2>&1
if errorlevel 1 (
  call npx --yes pm2 start bot.js --name lkz-discord-bot --time
)
call npx --yes pm2 save >nul 2>&1
