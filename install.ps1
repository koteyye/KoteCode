param(
  [string]$Version = $env:VERSION,
  [string]$InstallDir = $(if ($env:KOTECODE_INSTALL_DIR) { $env:KOTECODE_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA "KoteCode\bin" }),
  [string]$Binary
)

$ErrorActionPreference = "Stop"
$repository = "koteyye/KoteCode"

if ([Runtime.InteropServices.RuntimeInformation]::OSArchitecture -ne [Runtime.InteropServices.Architecture]::X64) {
  throw "KoteCode v0.1.0 supports Windows x64 only"
}

$asset = "kotecode-windows-x64.zip"
$versionNumber = $Version.TrimStart("v")
if ($versionNumber -and $versionNumber -notmatch "^[0-9]+\.[0-9]+\.[0-9]+([+-][0-9A-Za-z.-]+)?$") {
  throw "Invalid version: $Version"
}
$base = if ($versionNumber) {
  "https://github.com/$repository/releases/download/v$versionNumber"
} else {
  "https://github.com/$repository/releases/latest/download"
}

$temporaryDir = Join-Path ([IO.Path]::GetTempPath()) ("kotecode-install-" + [Guid]::NewGuid())
New-Item -ItemType Directory -Path $temporaryDir | Out-Null

try {
  if ($Binary) {
    $source = (Resolve-Path -LiteralPath $Binary).Path
  } else {
    Invoke-WebRequest -UseBasicParsing -Uri "$base/SHA256SUMS" -OutFile (Join-Path $temporaryDir "SHA256SUMS")
    Invoke-WebRequest -UseBasicParsing -Uri "$base/$asset" -OutFile (Join-Path $temporaryDir $asset)

    $assetPattern = [Regex]::Escape($asset)
    $line = Get-Content -LiteralPath (Join-Path $temporaryDir "SHA256SUMS") |
      Where-Object { $_ -match "^[0-9a-fA-F]{64}\s+\*?$assetPattern$" } |
      Select-Object -First 1
    if (-not $line) {
      throw "No valid checksum for $asset"
    }
    $expected = ($line -split "\s+")[0].ToLowerInvariant()
    $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $temporaryDir $asset)).Hash.ToLowerInvariant()
    if ($actual -ne $expected) {
      throw "Checksum mismatch for $asset"
    }

    $unpacked = Join-Path $temporaryDir "unpacked"
    Expand-Archive -LiteralPath (Join-Path $temporaryDir $asset) -DestinationPath $unpacked
    $source = Join-Path $unpacked "kotecode.exe"
    if (-not (Test-Path -LiteralPath $source)) {
      throw "$asset does not contain kotecode.exe"
    }
  }

  $smoke = [Diagnostics.ProcessStartInfo]::new($source)
  $smoke.ArgumentList.Add("--version")
  $smoke.UseShellExecute = $false
  $smoke.RedirectStandardOutput = $true
  $smoke.RedirectStandardError = $true
  $smoke.Environment["XDG_DATA_HOME"] = Join-Path $temporaryDir "data"
  $smoke.Environment["XDG_CACHE_HOME"] = Join-Path $temporaryDir "cache"
  $smoke.Environment["XDG_CONFIG_HOME"] = Join-Path $temporaryDir "config"
  $smoke.Environment["XDG_STATE_HOME"] = Join-Path $temporaryDir "state"
  $smokeProcess = [Diagnostics.Process]::Start($smoke)
  $smokeProcess.WaitForExit()
  if ($smokeProcess.ExitCode -ne 0) {
    throw "Downloaded kotecode.exe failed its version smoke test"
  }

  New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
  $target = Join-Path $InstallDir "kotecode.exe"
  $pending = Join-Path $InstallDir ".kotecode.new.exe"
  Copy-Item -LiteralPath $source -Destination $pending -Force

  if ($env:KOTECODE_UPGRADE_PID -and (Test-Path -LiteralPath $target)) {
    $helper = Join-Path $InstallDir ".kotecode-update.ps1"
    @'
param([int]$ParentPid, [string]$Source, [string]$Target)
$ErrorActionPreference = "Stop"
Wait-Process -Id $ParentPid -ErrorAction SilentlyContinue
Move-Item -LiteralPath $Source -Destination $Target -Force
Remove-Item -LiteralPath $PSCommandPath -Force
'@ | Set-Content -LiteralPath $helper -Encoding UTF8
    $hostExecutable = (Get-Process -Id $PID).Path
    Start-Process -FilePath $hostExecutable -WindowStyle Hidden -ArgumentList @(
      "-NoProfile",
      "-NonInteractive",
      "-File",
      "`"$helper`"",
      "-ParentPid",
      $env:KOTECODE_UPGRADE_PID,
      "-Source",
      "`"$pending`"",
      "-Target",
      "`"$target`""
    )
    Write-Host "KoteCode update verified and scheduled for installation after this process exits."
  } else {
    Move-Item -LiteralPath $pending -Destination $target -Force
    Write-Host "Installed KoteCode to $target"
  }

  if (($env:PATH -split ";") -notcontains $InstallDir) {
    Write-Host "Add KoteCode to your user PATH, then restart the terminal:"
    Write-Host "  [Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path', 'User') + ';$InstallDir', 'User')"
  }
} finally {
  Remove-Item -LiteralPath $temporaryDir -Recurse -Force -ErrorAction SilentlyContinue
}
