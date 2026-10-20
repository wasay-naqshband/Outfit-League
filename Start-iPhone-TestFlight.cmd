@echo off
cd /d "%~dp0"
set "EAS_NO_VCS=1"
set "EAS_PROJECT_ROOT=%~dp0"
set "EXPO_NO_KEYCHAIN=1"
set "PATH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback;%PATH%"
echo Outfit League - iPhone TestFlight build setup
echo Sign in to Apple yourself when Expo asks. Never send your password or verification code in chat.
echo This builds the app. It does not submit it to the App Store or purchase anything.
call pnpm dlx eas-cli@25.2.0 build --platform ios --profile testflight --no-wait
echo.
echo If Apple signing completed, share only the Expo build-page link with Codex.
pause
