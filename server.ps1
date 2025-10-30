param([int]$Port = 8080)
$prefix = "http://localhost:$Port/"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Host "Serving $root at $prefix"
while ($true) {
    $context = $listener.GetContext()
    $req = $context.Request
    $res = $context.Response
    try {
        $path = $req.Url.AbsolutePath.TrimStart('/')
        if ([string]::IsNullOrEmpty($path)) { $path = 'index.html' }
        $file = Join-Path $root $path
        if (Test-Path $file) {
            $bytes = [System.IO.File]::ReadAllBytes($file)
            if ($file.EndsWith('.html')) { $res.ContentType = 'text/html' }
            elseif ($file.EndsWith('.js')) { $res.ContentType = 'application/javascript' }
            elseif ($file.EndsWith('.css')) { $res.ContentType = 'text/css' }
            elseif ($file.EndsWith('.png')) { $res.ContentType = 'image/png' }
            elseif ($file.EndsWith('.jpg') -or $file.EndsWith('.jpeg')) { $res.ContentType = 'image/jpeg' }
            else { $res.ContentType = 'application/octet-stream' }
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $res.StatusCode = 404
            $bytes = [System.Text.Encoding]::UTF8.GetBytes('Not Found')
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
        }
    } catch {
        $res.StatusCode = 500
        $err = [System.Text.Encoding]::UTF8.GetBytes("Server error: $($_.Exception.Message)")
        $res.OutputStream.Write($err, 0, $err.Length)
    } finally {
        $res.Close()
    }
}
