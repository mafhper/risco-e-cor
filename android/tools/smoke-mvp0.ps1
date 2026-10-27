# Smoke MVP-0 no aparelho. ASCII apenas: o PowerShell 5.1 le o arquivo como ANSI.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File tools/smoke-mvp0.ps1
#   powershell -ExecutionPolicy Bypass -File tools/smoke-mvp0.ps1 -SkipInstall
#
# Saida: .dev-evidence/ com capturas, badging, logcat e resumo.

param(
    [switch]$SkipInstall,
    [string]$Serial = ""
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $here
$evidence = Join-Path $root ".dev-evidence"
New-Item -ItemType Directory -Force -Path $evidence | Out-Null

# ---------------------------------------------------------------- ambiente ---

$sdk = $env:ANDROID_SDK_ROOT
if (-not $sdk) {
    $local = Join-Path $root "local.properties"
    if (Test-Path $local) {
        $line = (Get-Content $local | Where-Object { $_ -like "sdk.dir=*" } | Select-Object -First 1)
        if ($line) {
            $sdk = ($line -replace "^sdk\.dir=", "") -replace "\\\\", "\" -replace "\\:", ":"
        }
    }
}
if (-not $sdk) { throw "sdk.dir nao encontrado" }

$adb = Join-Path $sdk "platform-tools\adb.exe"
$aapt2 = Get-ChildItem (Join-Path $sdk "build-tools") -Directory |
    Sort-Object Name -Descending | ForEach-Object { Join-Path $_.FullName "aapt2.exe" } |
    Where-Object { Test-Path $_ } | Select-Object -First 1
$apk = Join-Path $root "app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path $apk)) { throw "APK ausente: rode :app:assembleDebug" }

$script:prefix = @()
if ($Serial) { $script:prefix = @("-s", $Serial) }

function Adb {
    # Sem param(): assim "-r", "--user" e "-c" chegam ao adb como argumentos.
    # O adb escreve progresso em stderr; com ErrorActionPreference Stop isso
    # viraria exceção, então a função relaxa a preferência só durante a chamada.
    $ErrorActionPreference = "Continue"
    return (& $adb @script:prefix @args 2>&1)
}

function Shot([string]$name) {
    Adb shell screencap -p "/sdcard/$name.png" | Out-Null
    Adb pull "/sdcard/$name.png" (Join-Path $evidence "$name.png") | Out-Null
    Write-Host "  captura: $name.png"
}

function Get-Ui {
    Adb shell uiautomator dump /sdcard/ui.xml | Out-Null
    Adb pull /sdcard/ui.xml (Join-Path $evidence "ui.xml") | Out-Null
    return [xml](Get-Content -Path (Join-Path $evidence "ui.xml") -Raw -Encoding UTF8)
}

function Find-Node([string]$needle) {
    $doc = Get-Ui
    foreach ($node in $doc.SelectNodes("//node")) {
        $desc = $node.GetAttribute("content-desc")
        $text = $node.GetAttribute("text")
        if (($desc -and $desc -like "*$needle*") -or ($text -and $text -like "*$needle*")) {
            return $node
        }
    }
    return $null
}

function Assert-Node([string]$needle) {
    if (-not (Find-Node $needle)) { throw "esperava o no '$needle'" }
}

function Assert-NoNode([string]$needle) {
    if (Find-Node $needle) { throw "nao esperava o no '$needle'" }
}

function Tap-Desc([string]$needle, [int]$tries = 12) {
    for ($i = 0; $i -lt $tries; $i++) {
        $node = Find-Node $needle
        if ($node) {
            $m = [regex]::Matches($node.GetAttribute("bounds"), "\d+")
            $x = [int](([int]$m[0].Value + [int]$m[2].Value) / 2)
            $y = [int](([int]$m[1].Value + [int]$m[3].Value) / 2)
            Adb shell input tap $x $y | Out-Null
            Start-Sleep -Milliseconds 700
            return
        }
        Start-Sleep -Milliseconds 500
    }
    throw "nao achei o no '$needle'"
}

function Tap-At([int]$x, [int]$y) {
    Adb shell input tap $x $y | Out-Null
    Start-Sleep -Milliseconds 450
}

# ------------------------------------------------------- portoes do APK ---

Write-Host "== APK =="
$stream = [System.IO.File]::OpenRead($apk)
$hasher = [System.Security.Cryptography.SHA256]::Create()
$hashBytes = $hasher.ComputeHash($stream)
$stream.Close()
$sha = ($hashBytes | ForEach-Object { $_.ToString("x2") }) -join ""
$size = (Get-Item $apk).Length
Write-Host "  apk   : $apk"
Write-Host "  sha256: $sha"
Write-Host "  bytes : $size"

if (-not $aapt2) { throw "aapt2 nao encontrado" }
$badgingPath = Join-Path $evidence "badging.txt"
(& $aapt2 dump badging $apk) | Set-Content -Path $badgingPath -Encoding UTF8
$badging = Get-Content $badgingPath -Raw
if ($badging -match "uses-permission") { throw "manifest com permissao" }
if ($badging -notmatch "package: name='com.theomaria.draw'") { throw "package inesperado" }
if ($badging -notmatch "sdkVersion:'29'") { throw "minSdk inesperado" }
if ($badging -notmatch "targetSdkVersion:'36'") { throw "targetSdk inesperado" }
if ($badging -notmatch "application-label:'Meu Desenho'") { throw "label inesperada" }
Write-Host "  badging: sem permissao, minSdk 29, target 36, label 'Meu Desenho'"

# --------------------------------------------------------------- aparelho ---

Write-Host "== aparelho =="
$deadline = (Get-Date).AddSeconds(60)
$device = $null
while ((Get-Date) -lt $deadline) {
    $lines = Adb devices
    $device = $lines | Where-Object { $_ -match "\sdevice$" } | Select-Object -First 1
    if ($device) { break }
    Start-Sleep -Seconds 2
}
if (-not $device) { throw "nenhum aparelho adb disponivel" }
Write-Host "  $($device.Trim())"

if (-not $SkipInstall) {
    Write-Host "== instalar =="
    $install = Adb install -r --user 0 $apk
    $install | Set-Content -Path (Join-Path $evidence "install.txt") -Encoding UTF8
    if (-not ($install -match "Success")) { throw "instalacao falhou: $install" }
}

Adb shell pm clear com.theomaria.draw | Out-Null
Adb logcat -c | Out-Null
Adb shell am start -n com.theomaria.draw/.AppActivity | Out-Null
Start-Sleep -Seconds 3

# ------------------------------------------------------------------ fluxo ---

Write-Host "== home =="
Assert-Node "Entrar no perfil de Maria"
Assert-Node "Mural da fam"
Assert-Node "Configura"
Shot "01-home"

Write-Host "== perfil Maria (pro) =="
Tap-Desc "Entrar no perfil de Maria"
Assert-Node "Criar com Maria"
Assert-Node "Meus desenhos"
Shot "02-perfil-maria"

Write-Host "== criar pagina para colorir =="
Tap-Desc "Criar com Maria"
Assert-Node "Folha em branco"
Assert-Node "para colorir"
Shot "03-criar"

Tap-Desc "para colorir"
Start-Sleep -Seconds 2
Assert-Node "Balde"
Shot "04-canvas-limpo"

Write-Host "== localizar o papel =="
$shot = Join-Path $evidence "04-canvas-limpo.png"
$bounds = (& python (Join-Path $here "paper-bounds.py") $shot) -join " "
if ($LASTEXITCODE -ne 0) { throw "paper-bounds falhou" }
$parts = $bounds.Trim() -split "\s+"
if ($parts.Count -lt 4) { throw "paper-bounds sem 4 numeros: $bounds" }
$left = [int]$parts[0]
$top = [int]$parts[1]
$right = [int]$parts[2]
$bottom = [int]$parts[3]
Write-Host "  papel: $left,$top -> $right,$bottom"

function Page-Tap([int]$pageX, [int]$pageY) {
    $x = [int]($left + $pageX * ($right - $left) / 1024.0)
    $y = [int]($top + $pageY * ($bottom - $top) / 1024.0)
    Tap-At $x $y
}

Write-Host "== fill vermelho na regiao 6 =="
Tap-Desc "Balde"
Tap-Desc "vermelho"
Page-Tap 730 512
Shot "05-fill-vermelho"

Write-Host "== fill azul na regiao 4 =="
Tap-Desc "azul"
Page-Tap 200 620
Shot "06-fill-azul"

Write-Host "== desfazer e refazer =="
Tap-Desc "Desfazer"
Shot "07-desfazer"
Tap-Desc "Refazer"
Shot "08-refazer"

Write-Host "== guardar e publicar =="
Tap-Desc "Guardar"
Assert-Node "Publicar no mural"
Shot "09-guardar"
Tap-Desc "Publicar no mural"
Assert-Node "Criar com Maria"
Shot "10-perfil-publicado"

Write-Host "== voltar para a Home =="
Tap-Desc "Voltar"
Assert-Node "Entrar no perfil de Maria"
Assert-Node "Abrir pe"
Shot "11-home-com-mural"

Write-Host "== galeria =="
Tap-Desc "Entrar no perfil de Maria"
Tap-Desc "Meus desenhos"
Assert-Node "Abrir pe"
Shot "12-galeria"

Write-Host "== rascunho: desenhar, guardar, apagar com desfazer =="
Adb shell input keyevent 4 | Out-Null
Start-Sleep -Milliseconds 700
Tap-Desc "Criar com Maria"
Tap-Desc "Folha em branco"
Assert-Node "Guardar"
Adb shell input swipe 260 1100 780 1400 450 | Out-Null
Start-Sleep -Milliseconds 500
Tap-Desc "Guardar"
Assert-Node "Guardar rascunho"
Tap-Desc "Guardar rascunho"
Assert-Node "Criar com Maria"
Tap-Desc "Meus desenhos"
Assert-Node "Apagar rascunho"
Shot "12b-galeria-com-rascunho"
Tap-Desc "Apagar rascunho"
Assert-Node "Desfazer"
Shot "12c-rascunho-apagado"
Tap-Desc "Desfazer"
Assert-Node "Apagar rascunho"
Shot "12d-rascunho-restaurado"

Tap-Desc "Voltar"
Tap-Desc "Voltar"
Assert-Node "Entrar no perfil de Maria"

Write-Host "== perfil Theo (kids 3-5) =="
Tap-Desc "Entrar no perfil de Theo"
Assert-Node "para colorir"
Assert-Node "Folha em branco"
Assert-NoNode "Meus desenhos"
Assert-NoNode "Criar com"
Shot "13-perfil-theo-kids"

Write-Host "== canvas kids (sem texto, 6 cores 56dp) =="
Tap-Desc "para colorir"
Assert-Node "Feito"
Assert-Node "Balde"
Assert-Node "vermelho"
Assert-Node "roxo"
Shot "14-canvas-kids"
# Folha vazia: voltar descarta e devolve ao perfil.
Adb shell input keyevent 4 | Out-Null
Start-Sleep -Milliseconds 900
Assert-Node "Folha em branco"
Shot "15-kids-voltou"

# -------------------------------------------------------------- evidencias ---

Write-Host "== log =="
$logPath = Join-Path $evidence "logcat.txt"
Adb logcat -d -s MeuDesenho:V AndroidRuntime:E | Set-Content -Path $logPath -Encoding UTF8
$log = Get-Content $logPath -Raw
$fills = ([regex]::Matches($log, "fill label=")).Count
$leaks = ([regex]::Matches($log, "leaks=[1-9]")).Count
$saves = ([regex]::Matches($log, "peca guardada")).Count
if ($fills -lt 2) { throw "esperava 2 fills no log, achei $fills" }
if ($leaks -ne 0) { throw "fill vazou ($leaks ocorrencias)" }
if ($saves -lt 1) { throw "esperava publicacao no log" }

$summary = @(
    "sha256=$sha",
    "bytes=$size",
    "fills=$fills",
    "leaks=$leaks",
    "saves=$saves",
    "device=$($device.Trim())"
)
$summary | Set-Content -Path (Join-Path $evidence "summary.txt") -Encoding UTF8
$summary | ForEach-Object { Write-Host "  $_" }
Write-Host "OK"
