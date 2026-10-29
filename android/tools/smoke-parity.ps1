# Smoke de paridade no aparelho: navega por content-desc (busca ASCII), tira
# captura nativa e despeja a arvore de UI. Sem emulador, sem suposicao.
#
#   powershell -File tools/smoke-parity.ps1
#
# Saida em .evidence/parity/ (capturas + ui-*.xml + relatorio.txt).

param(
    [string]$Sdk = "C:\Users\mafhper\Documents\Tools\android",
    [string]$Serial = "RFCN70CWW3J",
    [string]$Out = ".evidence\parity",
    [switch]$SeedWall
)

$ErrorActionPreference = "Stop"
$adb = Join-Path $Sdk "platform-tools\adb.exe"
$pkg = "com.theomaria.draw"
New-Item -ItemType Directory -Force -Path $Out | Out-Null
$log = Join-Path $Out "relatorio.txt"
if (Test-Path $log) { Remove-Item $log }
function Note($text) { $text | Tee-Object -FilePath $log -Append }

function Adb { & $adb -s $Serial @args }

function Dump {
    Adb shell uiautomator dump /sdcard/ui.xml | Out-Null
    Adb pull /sdcard/ui.xml (Join-Path $Out "ui-tmp.xml") | Out-Null
    return [xml](Get-Content (Join-Path $Out "ui-tmp.xml") -Raw -Encoding UTF8)
}

function FindNode($xml, $needle) {
    foreach ($node in $xml.SelectNodes("//node")) {
        $desc = $node.GetAttribute("content-desc")
        $text = $node.GetAttribute("text")
        if ($desc -and $desc.Contains($needle)) { return $node }
        if ($text -and $text.Contains($needle)) { return $node }
    }
    return $null
}

function Bounds($node) {
    $b = $node.GetAttribute("bounds")
    if ($b -notmatch '\[(\d+),(\d+)\]\[(\d+),(\d+)\]') { throw "bounds ilegivel: $b" }
    return @([int]$matches[1], [int]$matches[2], [int]$matches[3], [int]$matches[4])
}

function Tap($needle, [switch]$Quiet) {
    $xml = Dump
    $node = FindNode $xml $needle
    if (-not $node) { throw "nao achei '$needle'" }
    $b = Bounds $node
    $x = [int](($b[0] + $b[2]) / 2)
    $y = [int](($b[1] + $b[3]) / 2)
    Adb shell input tap $x $y | Out-Null
    Start-Sleep -Milliseconds 700
    if (-not $Quiet) { Note ("tap '{0}' em {1},{2}" -f $needle, $x, $y) }
    return @($x, $y)
}

function Shot($name) {
    $remote = "/sdcard/$name.png"
    Adb shell screencap -p $remote | Out-Null
    Adb pull $remote (Join-Path $Out "$name.png") | Out-Null
    Adb shell rm $remote | Out-Null
    Note "captura $name.png"
}

function SaveDump($name) {
    Adb shell uiautomator dump /sdcard/ui.xml | Out-Null
    Adb pull /sdcard/ui.xml (Join-Path $Out "ui-$name.xml") | Out-Null
    Note "arvore ui-$name.xml"
}

# --- estado do aparelho ---------------------------------------------------
$size = (Adb shell wm size) -join " "
$density = (Adb shell wm density) -join " "
$dpi = 480
if ($density -match '(\d+)') { $dpi = [int]$matches[1] }
$scale = $dpi / 160.0
Note "aparelho=$Serial $size $density scale=$scale"

Adb install -r --user 0 "app\build\outputs\apk\debug\app-debug.apk" | Tee-Object -FilePath $log -Append
Adb shell am force-stop $pkg | Out-Null
Adb shell am start -n "$pkg/.AppActivity" | Out-Null
Start-Sleep -Seconds 3

# --- duas pecas na parede, pelo caminho real (criar -> traco -> publicar) ---
function SeedPiece($who, $fromX, $fromY, $toX, $toY) {
    Tap "Nova pe" | Out-Null
    Tap $who | Out-Null
    Start-Sleep -Milliseconds 900
    Adb shell input swipe $fromX $fromY $toX $toY 400 | Out-Null
    Start-Sleep -Milliseconds 600
    Tap "Guardar" | Out-Null
    Start-Sleep -Milliseconds 500
    Tap "Publicar no mural" | Out-Null
    Start-Sleep -Milliseconds 900
    Note "peca publicada para $who"
}

if ($SeedWall) {
    SeedPiece "Criar com Maria" 360 900 700 1300
    SeedPiece "Criar com Theo" 300 1400 680 1000
}

$homeXml = Dump
if (-not (FindNode $homeXml "Mural da")) {
    # Acento nao passa por literal de shell; o titulo sempre tem "Mural da".
    Note "home sem 'Mural da' na arvore; seguindo pelo perfil"
}

Shot "01-home"
SaveDump "01-home"

Tap "perfil de Maria"
Shot "02-perfil-maria"
SaveDump "02-perfil-maria"

Tap "a desenhar"
Tap "para colorir"
Start-Sleep -Milliseconds 800
Shot "03-canvas-mini"
SaveDump "03-canvas-mini"
$miniDump = Dump
$dock = FindNode $miniDump "Barra de ferramentas"
$hud = FindNode $miniDump "Zoom"
if ($dock -and $hud) {
    $db = Bounds $dock
    $hb = Bounds $hud
    $gapPx = $db[1] - $hb[3]
    $gapDp = [math]::Round($gapPx / $scale, 1)
    Note "dock bounds=$($db -join ',') hud bounds=$($hb -join ',')"
    Note "folga zoom/dock = $gapPx px = $gapDp dp; intersecao=$($hb[3] -gt $db[1])"
}

Tap "Aumentar zoom"
Shot "04-canvas-zoom"
SaveDump "04-canvas-zoom"
$zoomDump = Dump
$dock = FindNode $zoomDump "Barra de ferramentas"
$hud = FindNode $zoomDump "Zoom"
if ($dock -and $hud) {
    $db = Bounds $dock
    $hb = Bounds $hud
    $gapPx = $db[1] - $hb[3]
    $gapDp = [math]::Round($gapPx / $scale, 1)
    Note "dock bounds=$($db -join ',') hud bounds=$($hb -join ',')"
    Note "folga zoom/dock = $gapPx px = $gapDp dp; intersecao=$($hb[3] -gt $db[1])"
}
Tap "Ajustar" -Quiet
Tap "Trocar ferramenta"
Shot "05-canvas-compacto"
SaveDump "05-canvas-compacto"

Tap "Expandir painel"
Shot "06-canvas-expandido"
SaveDump "06-canvas-expandido"

Note "FIM"



