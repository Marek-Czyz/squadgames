param([string]$pptx, [string]$outDir, [string]$pdf = "")
$pp = New-Object -ComObject PowerPoint.Application
$p = $pp.Presentations.Open($pptx, $true, $false, $false)
$i = 1
foreach ($s in $p.Slides) { $s.Export("$outDir\s$i.png", "PNG", 1600, 900); $i++ }
if ($pdf -ne "") { $p.SaveAs($pdf, 32) }
$p.Close()
