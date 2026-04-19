@echo off
echo === Voxel Arena - Сборка EXE ===
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo ОШИБКА: Node.js не найден. Скачай с https://nodejs.org
  pause
  exit /b 1
)

echo [1/3] Устанавливаем зависимости...
call npm install
if %errorlevel% neq 0 (
  echo ОШИБКА при npm install
  pause
  exit /b 1
)

echo [2/3] Собираем EXE...
call npm run build-win
if %errorlevel% neq 0 (
  echo ОШИБКА при сборке
  pause
  exit /b 1
)

echo.
echo [3/3] Готово! EXE находится в папке dist\
echo.
explorer dist
pause
