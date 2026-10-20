$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$runtimeNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCommand) { $runtimeNode = $nodeCommand.Source }
if (-not (Test-Path -LiteralPath $runtimeNode)) { throw 'Install Node.js 22 or later, then try again.' }
& $runtimeNode scripts/preview.cjs
