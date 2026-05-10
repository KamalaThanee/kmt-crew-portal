param(
  [Parameter(Mandatory = $true)]
  [string]$SourcePath,

  [string]$OutputPath = "",

  [switch]$Recurse,

  [switch]$Overwrite,

  [int]$TimeoutSeconds = 90
)

$ErrorActionPreference = "Stop"

function Get-RelativePathSafe {
  param(
    [string]$BasePath,
    [string]$TargetPath
  )

  $baseUri = [System.Uri]((Resolve-Path -LiteralPath $BasePath).Path.TrimEnd('\') + '\')
  $targetUri = [System.Uri]((Resolve-Path -LiteralPath $TargetPath).Path)
  return [System.Uri]::UnescapeDataString($baseUri.MakeRelativeUri($targetUri).ToString()).Replace('/', '\')
}

$source = (Resolve-Path -LiteralPath $SourcePath).Path
$outputRoot = if ($OutputPath.Trim()) {
  if (-not (Test-Path -LiteralPath $OutputPath)) {
    New-Item -ItemType Directory -Path $OutputPath | Out-Null
  }
  (Resolve-Path -LiteralPath $OutputPath).Path
} else {
  $source
}

$files = Get-ChildItem -LiteralPath $source -File -Recurse:$Recurse |
  Where-Object { $_.Extension -ieq ".doc" -and $_.Name -notlike '~$*' }

if ($files.Count -eq 0) {
  Write-Host "No legacy .doc files found in: $source"
  exit 0
}

$converted = 0
$skipped = 0
$failed = 0
$timedOut = 0

foreach ($file in $files) {
  try {
    $relative = Get-RelativePathSafe -BasePath $source -TargetPath $file.FullName
    $relativeDocx = [System.IO.Path]::ChangeExtension($relative, ".docx")
    $destination = Join-Path $outputRoot $relativeDocx
    $destinationDir = Split-Path -Parent $destination

    if (-not (Test-Path -LiteralPath $destinationDir)) {
      New-Item -ItemType Directory -Path $destinationDir | Out-Null
    }

    if ((Test-Path -LiteralPath $destination) -and -not $Overwrite) {
      Write-Host "SKIP existing: $destination"
      $skipped += 1
      continue
    }

    Write-Host "Converting: $($file.FullName)"
    $job = Start-Job -ScriptBlock {
      param($SourceFile, $DestinationFile)

      $word = $null
      $doc = $null
      try {
        $word = New-Object -ComObject Word.Application
        $word.Visible = $false
        $word.DisplayAlerts = 0
        $word.AutomationSecurity = 3

        $doc = $word.Documents.OpenNoRepairDialog($SourceFile, $false, $true, $false)
        $doc.SaveAs2($DestinationFile, 16)
      } finally {
        try {
          if ($doc) { $doc.Close($false) }
        } catch {}
        try {
          if ($word) { $word.Quit() }
        } catch {}
        try {
          if ($doc) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null }
          if ($word) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null }
        } catch {}
      }
    } -ArgumentList $file.FullName, $destination

    if (Wait-Job -Job $job -Timeout $TimeoutSeconds) {
      Receive-Job -Job $job -ErrorAction Stop | Out-Null
      Remove-Job -Job $job -Force
      $converted += 1
      Write-Host "  -> $destination"
    } else {
      Stop-Job -Job $job
      Remove-Job -Job $job -Force
      $timedOut += 1
      Write-Warning "TIMEOUT after $TimeoutSeconds seconds: $($file.FullName)"
      Write-Warning "If Microsoft Word remains open in Task Manager, close WINWORD.EXE before rerunning."
    }
  } catch {
    $failed += 1
    Write-Warning "FAILED: $($file.FullName) :: $($_.Exception.Message)"
  }
}

Write-Host ""
Write-Host "Done. Converted=$converted Skipped=$skipped Failed=$failed TimedOut=$timedOut"
Write-Host "Output: $outputRoot"
