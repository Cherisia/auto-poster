@echo off
cd /d "%~dp0"

echo.
echo ========================================
echo   serenkit 블로그 글 자동 생성
echo ========================================

if "%1"=="" (
  echo   모드: 큐에서 다음 계산기 자동 선택
  echo.
  node generate.js
) else if "%1"=="--all" (
  echo   모드: 큐 전체 생성
  echo.
  node generate.js --all
) else (
  echo   모드: 지정 계산기 [%1]
  echo.
  node generate.js %1
)

echo.
pause
