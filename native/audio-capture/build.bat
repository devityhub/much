@echo off
setlocal
cd /d "%~dp0"

where cmake >nul 2>nul
if errorlevel 1 (
  echo [audio-capture] CMake nao encontrado. Instale o Visual Studio Build Tools com "Desenvolvimento para desktop com C++".
  exit /b 1
)

cmake -S . -B build -A x64 || exit /b 1
cmake --build build --config Release || exit /b 1

echo.
echo [audio-capture] Pronto: %~dp0build\Release\audio-capture.exe
