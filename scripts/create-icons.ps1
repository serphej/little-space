Add-Type -AssemblyName System.Drawing
$assetDirectory = Join-Path $PSScriptRoot '../public'
foreach ($iconSpec in @(@{Size=192;Name='icon-192.png'},@{Size=512;Name='icon-512.png'},@{Size=512;Name='icon-maskable-512.png'},@{Size=180;Name='apple-touch-icon.png'})) {
  $iconSize = $iconSpec.Size
  $bitmap = New-Object System.Drawing.Bitmap($iconSize, $iconSize)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#dcebf8'))
  $brush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#4277d8'))
  $inset = [single]($iconSize * .2)
  $extent = [single]($iconSize * .6)
  $graphics.FillEllipse($brush, $inset, $inset, $extent, $extent)
  $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [single]($iconSize * .045))
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $points = [System.Drawing.PointF[]]@([System.Drawing.PointF]::new($iconSize*.34,$iconSize*.5),[System.Drawing.PointF]::new($iconSize*.46,$iconSize*.61),[System.Drawing.PointF]::new($iconSize*.67,$iconSize*.38))
  $graphics.DrawLines($pen, $points)
  $bitmap.Save((Join-Path $assetDirectory $iconSpec.Name), [System.Drawing.Imaging.ImageFormat]::Png)
  $pen.Dispose()
  $brush.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}
