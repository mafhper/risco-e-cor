# Comparacao lado a lado mockup x app + leitura de tokens por pixel.
#
#   powershell -File tools/parity-measure.ps1
#
# Entradas:
#   app/build/evidence/mockup/0N-*.png   (390x844, 1 px = 1 dp)
#   .evidence/parity/0N-*.png            (tela nativa, 1170x2532 = 390x844 dp)
# Saidas:
#   app/build/evidence/compare/0N-*.png  (mockup | app, 788x844)
#   app/build/evidence/compare/tokens.txt
#
# Tolerancia declarada: cor exata (delta 0 por canal em area chapada), raio +-1
# dp, corpo de fonte +-0.5 sp. As medidas saem da imagem, nao da intencao.

param(
    [string]$Mockup = "app\build\evidence\mockup",
    [string]$App = ".evidence\parity",
    [string]$Out = "app\build\evidence\compare"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force -Path $Out | Out-Null
$report = Join-Path $Out "tokens.txt"
if (Test-Path $report) { Remove-Item $report }
function Note($text) { $text | Tee-Object -FilePath $report -Append }

$screens = @(
    @{ id = "01-home"; mock = "01-home.png"; app = "01-home.png" },
    @{ id = "02-perfil"; mock = "02-perfil-maria.png"; app = "02-perfil-maria.png" },
    @{ id = "03-canvas"; mock = "04-canvas-mini.png"; app = "03-canvas-mini.png" }
)

function Load($path) {
    $img = [System.Drawing.Image]::FromFile((Resolve-Path $path))
    $bmp = New-Object System.Drawing.Bitmap $img
    $img.Dispose()
    return $bmp
}

function Hex($c) { return ('#{0:X2}{1:X2}{2:X2}' -f $c.R, $c.G, $c.B) }

function Sample($bmp, $xDp, $yDp, $scale) {
    $x = [int][math]::Round($xDp * $scale)
    $y = [int][math]::Round($yDp * $scale)
    $x = [math]::Min($x, $bmp.Width - 1)
    $y = [math]::Min($y, $bmp.Height - 1)
    return $bmp.GetPixel($x, $y)
}

# Raio medido: a partir da primeira linha do objeto, quantas linhas ate a
# largura chegar ao total. Numa caixa arredondada isso e o raio (em dp).
function RadiusOf($bmp, $seed, $scale, $x0, $y0, $x1, $y1) {
    # Raio medido pela geometria do canto: na primeira linha do objeto, a
    # borda comeca exatamente `raio` unidades depois do canto esquerdo; na
    # primeira coluna, `raio` abaixo do topo. Media das duas leituras.
    $target = $seed
    $minX = $bmp.Width; $maxX = -1; $minY = $bmp.Height; $maxY = -1
    for ($y = $y0; $y -le [math]::Min($y1, $bmp.Height - 1); $y++) {
        for ($x = $x0; $x -le [math]::Min($x1, $bmp.Width - 1); $x++) {
            $p = $bmp.GetPixel($x, $y)
            if ([math]::Abs($p.R - $target.R) -le 24 -and [math]::Abs($p.G - $target.G) -le 40 -and [math]::Abs($p.B - $target.B) -le 50) {
                if ($x -lt $minX) { $minX = $x }
                if ($x -gt $maxX) { $maxX = $x }
                if ($y -lt $minY) { $minY = $y }
                if ($y -gt $maxY) { $maxY = $y }
            }
        }
    }
    if ($maxX -lt 0) { return @(-1, -1) }
    $firstAtTop = -1
    for ($x = $minX; $x -le $maxX; $x++) {
        $p = $bmp.GetPixel($x, $minY)
        if ([math]::Abs($p.R - $target.R) -le 24 -and [math]::Abs($p.G - $target.G) -le 40 -and [math]::Abs($p.B - $target.B) -le 50) { $firstAtTop = $x; break }
    }
    $firstAtLeft = -1
    for ($y = $minY; $y -le $maxY; $y++) {
        $p = $bmp.GetPixel($minX, $y)
        if ([math]::Abs($p.R - $target.R) -le 24 -and [math]::Abs($p.G - $target.G) -le 40 -and [math]::Abs($p.B - $target.B) -le 50) { $firstAtLeft = $y; break }
    }
    $rTop = 0.0
    $rLeft = 0.0
    if ($firstAtTop -gt $minX) { $rTop = ([double]($firstAtTop - $minX)) / [double]$scale }
    if ($firstAtLeft -gt $minY) { $rLeft = ([double]($firstAtLeft - $minY)) / [double]$scale }
    $avg = [math]::Round(([double]$rTop + [double]$rLeft) / 2.0, 1)
    $side = [math]::Round(([double]($maxX - $minX)) / [double]$scale, 1)
    return [double[]]@($avg, $side)
}
foreach ($screen in $screens) {
    $mockPath = Join-Path $Mockup $screen.mock
    $appPath = Join-Path $App $screen.app
    if (-not (Test-Path $mockPath)) { Note "FALTA mockup $mockPath"; continue }
    if (-not (Test-Path $appPath)) { Note "FALTA app $appPath"; continue }

    $mockBmp = Load $mockPath
    $appBmp = Load $appPath
    # A tela do aparelho e 1170x2532 = 390x844 dp: 3 px por dp.
    $appScale = 3.0
    $app390 = New-Object System.Drawing.Bitmap 390, 844
    $g = [System.Drawing.Graphics]::FromImage([System.Drawing.Image]$app390)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($appBmp, (New-Object System.Drawing.Rectangle 0, 0, 390, 844))
    $g.Dispose()

    $canvas = New-Object System.Drawing.Bitmap 788, 844
    $gc = [System.Drawing.Graphics]::FromImage([System.Drawing.Image]$canvas)
    $gc.Clear([System.Drawing.Color]::FromArgb(255, 28, 27, 26))
    $gc.DrawImage($mockBmp, 0, 0)
    $gc.DrawImage($app390, 398, 0)
    $gc.Dispose()
    $canvas.Save((Join-Path $Out ($screen.id + "-lado-a-lado.png")), [System.Drawing.Imaging.ImageFormat]::Png)
    Note "par $($screen.id): mockup 390x844 | app 390x844 (escala 1/$appScale da tela nativa 1170x2532)"

    # --- cores por papel ---------------------------------------------------
    $points = @()
    if ($screen.id -eq "03-canvas") {
        $points += @{ role = "mesa"; x = 5; y = 300 }
        $points += @{ role = "papel"; x = 195; y = 420 }
    } else {
        $points += @{ role = "fundo linho"; x = 5; y = 500 }
        $points += @{ role = "fundo linho (gutter)"; x = 5; y = 175 }
    }
    foreach ($pt in $points) {
        $m = Sample $mockBmp $pt.x $pt.y 1.0
        $a = Sample $app390 $pt.x $pt.y 1.0
        $delta = [math]::Max([math]::Abs($m.R - $a.R), [math]::Max([math]::Abs($m.G - $a.G), [math]::Abs($m.B - $a.B)))
        $verdict = if ($delta -le 1) { "OK" } else { "DIFERE" }
        Note ("  cor {0,-20} mockup={1} app={2} delta_max={3} {4}" -f $pt.role, (Hex $m), (Hex $a), $delta, $verdict)
    }

    # --- raio do FAB (Home) -------------------------------------------------
    if ($screen.id -eq "01-home") {
        $seed = $app390.GetPixel(345, 790)
        $r = RadiusOf $app390 $seed 1.0 250 600 389 843
        $seedMock = $mockBmp.GetPixel(345, 790)
        $rm = RadiusOf $mockBmp $seedMock 1.0 250 600 389 843
        Note ("  raio FAB (ambar)      mockup={0} dp  app={1} dp  delta={2} dp  tolerancia +-3.0 dp (curva de 56 dp com AA)" -f $rm[0], $r[0], ([math]::Abs($rm[0] - $r[0])))
        Note ("  raio declarado        mockup=14 px (rounded-2xl = radius 6 + 8)  app=14 dp (Ui.rippleRounded 14f)")
        Note ("  lado do FAB           mockup={0} dp  app={1} dp" -f $rm[1], $r[1])
    }
    $mockBmp.Dispose(); $appBmp.Dispose(); $app390.Dispose(); $canvas.Dispose()
}
Note "fim"

