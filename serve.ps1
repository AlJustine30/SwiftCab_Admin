Param(
    [int]$Port = 5510
)

$ErrorActionPreference = "Stop"

for ($p = $Port; $p -le ($Port + 10); $p++) {
    $listener = New-Object System.Net.HttpListener
    try {
        $prefix = "http://localhost:$p/"
        $listener.Prefixes.Add($prefix)
        $listener.Start()
        Write-Host "Static server running at $prefix" -ForegroundColor Green
        Start-Process $prefix
        break
    } catch {
        try { $listener.Stop() } catch {}
        if ($p -eq ($Port + 10)) { throw }
    }
}

function Get-ContentType($path) {
    switch ([System.IO.Path]::GetExtension($path).ToLower()) {
        ".html" { return "text/html" }
        ".css"  { return "text/css" }
        ".js"   { return "application/javascript" }
        ".json" { return "application/json" }
        ".png"  { return "image/png" }
        ".jpg"  { return "image/jpeg" }
        ".jpeg" { return "image/jpeg" }
        ".svg"  { return "image/svg+xml" }
        default  { return "text/plain" }
    }
}

try {
    while ($true) {
        $context = $listener.GetContext()
        $req = $context.Request
        $res = $context.Response
        $path = $req.Url.AbsolutePath.TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($path)) { $path = 'index.html' }
        $localPath = Join-Path $PSScriptRoot $path
        if (-not (Test-Path $localPath)) {
            $res.StatusCode = 404
            $msg = "Not Found"
            $bytes = [Text.Encoding]::UTF8.GetBytes($msg)
            $res.ContentType = "text/plain"
            $res.OutputStream.Write($bytes,0,$bytes.Length)
            $res.OutputStream.Close()
            continue
        }
        $bytes = [System.IO.File]::ReadAllBytes($localPath)
        $res.ContentType = Get-ContentType $localPath
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes,0,$bytes.Length)
        $res.OutputStream.Close()
    }
}
finally {
    $listener.Stop()
}
