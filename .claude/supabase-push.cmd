@echo off
rem Signs in to Supabase (you approve in the browser), then applies new database migrations.
cd /d "%~dp0.."
set "PATH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
call node_modules\.bin\supabase.CMD login || exit /b 1
call node_modules\.bin\supabase.CMD migration list --linked
call node_modules\.bin\supabase.CMD db push --linked
