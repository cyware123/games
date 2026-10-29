param([string]$Root=$env:ENROQUE_ROOT)
# Servidor local sin instalar Python, Node ni paquetes. Compatible con Windows PowerShell 5.
$ErrorActionPreference='Stop'
if (-not $Root) { $Root=$PSScriptRoot }
$Root=[IO.Path]::GetFullPath($Root)
$address=[Net.IPAddress]::Loopback
if ($env:ENROQUE_LAN -eq '1') { $address=[Net.IPAddress]::Any }
$listener=$null
for ($port=8765; $port -le 8780; $port++) {
  try { $listener=New-Object Net.Sockets.TcpListener($address,$port); $listener.Start(); break }
  catch { $listener=$null }
}
if (-not $listener) { throw 'No hay un puerto local disponible entre 8765 y 8780.' }
$url="http://127.0.0.1:$port/"
Write-Host "ENROQUE - Stockfish y entrenamiento sin Internet" -ForegroundColor Green
Write-Host "Abre $url"
Write-Host 'Mantén esta ventana abierta mientras juegas. Ctrl+C para detener.'
if ($env:ENROQUE_LAN -eq '1') {
  Write-Host 'Para el celular: misma red Wi-Fi y la IP local de este PC con este puerto.'
  Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object {$_.IPAddress -notmatch '^(127\.|169\.254\.)'} | ForEach-Object {Write-Host "Celular: http://$($_.IPAddress):$port/"}
}
Start-Process $url
$types=@{'.html'='text/html; charset=utf-8';'.js'='text/javascript; charset=utf-8';'.css'='text/css; charset=utf-8';'.json'='application/json; charset=utf-8';'.wasm'='application/wasm';'.txt'='text/plain; charset=utf-8';'.md'='text/plain; charset=utf-8';'.gz'='application/gzip';'.zip'='application/zip'}
try {
  while ($true) {
    $client=$listener.AcceptTcpClient(); $client.ReceiveTimeout=5000; $client.SendTimeout=30000
    try {
      $stream=$client.GetStream()
      $reader=New-Object IO.StreamReader($stream,[Text.Encoding]::ASCII,$false,4096,$true)
      $request=$reader.ReadLine()
      if (-not $request) {continue}
      $parts=$request.Split(' ')
      for($i=0;$i -lt 100;$i++){ $header=$reader.ReadLine(); if(-not $header){break} }
      $method=$parts[0]
      $relative=[Uri]::UnescapeDataString(($parts[1].Split('?')[0])).TrimStart('/')
      if (-not $relative) {$relative='index.html'}
      $path=[IO.Path]::GetFullPath((Join-Path $Root $relative))
      $inside=$path.StartsWith($Root.TrimEnd([char[]]'\/')+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)
      $relative=$relative.Replace('\','/')
      $private=$relative -match '(^|/)\.' -or $relative -match '(^|/)node_modules(/|$)'
      $rootAllowed=@('index.html','style.css','app.js','boot.js','LEEME.html','README.md','SOURCES.md','ASSETS.sha256')
      $allowed=($rootAllowed -contains $relative) -or ($relative -match '^(data|engine|vendor)/')
      $status='200 OK'; $type='text/plain; charset=utf-8'
      if ($method -ne 'GET' -and $method -ne 'HEAD') {$status='405 Method Not Allowed';$bytes=[Text.Encoding]::UTF8.GetBytes('Solo GET y HEAD.')}
      elseif (-not $inside -or $private -or -not $allowed) {$status='403 Forbidden';$bytes=[Text.Encoding]::UTF8.GetBytes('Acceso denegado.')}
      elseif (-not [IO.File]::Exists($path)) {$status='404 Not Found';$bytes=[Text.Encoding]::UTF8.GetBytes('Archivo no encontrado. Copia la carpeta completa de Enroque.')}
      else {$bytes=[IO.File]::ReadAllBytes($path);$ext=[IO.Path]::GetExtension($path).ToLower();if($types.ContainsKey($ext)){$type=$types[$ext]}else{$type='application/octet-stream'}}
      $response="HTTP/1.1 $status`r`nContent-Type: $type`r`nContent-Length: $($bytes.Length)`r`nCache-Control: no-cache`r`nX-Content-Type-Options: nosniff`r`nConnection: close`r`n`r`n"
      $head=[Text.Encoding]::ASCII.GetBytes($response);$stream.Write($head,0,$head.Length)
      if($method -ne 'HEAD'){$stream.Write($bytes,0,$bytes.Length)}
      $stream.Flush()
    } catch {Write-Host ('Petición interrumpida: '+$_.Exception.Message) -ForegroundColor DarkGray}
    finally {$client.Close()}
  }
} finally {$listener.Stop()}
