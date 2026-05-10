param(
  [Parameter(Mandatory = $true)]
  [string]$SourcePath,

  [string]$OutputPath = "",

  [switch]$Recurse,

  [switch]$Overwrite
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

$word = $null
$converted = 0
$skipped = 0
$failed = 0

try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0

  foreach ($file in $files) {
    $doc = $null
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
      $doc = $word.Documents.Open($file.FullName, $false, $true)
      $doc.SaveAs2($destination, 16)
      $doc.Close($false)
      $converted += 1
      Write-Host "  -> $destination"
    } catch {
      $failed += 1
      Write-Warning "FAILED: $($file.FullName) :: $($_.Exception.Message)"
      try {
        if ($doc) { $doc.Close($false) }
      } catch {}
    }
  }
} finally {
  if ($word) {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
  }
}

Write-Host ""
Write-Host "Done. Converted=$converted Skipped=$skipped Failed=$failed"
Write-Host "Output: $outputRoot"
