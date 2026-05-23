$path = "c:\Users\Pichau\OneDrive\documentos\big\Avarias-AG-G300-main (14)\Avarias-AG-G300-main\src\app\page.tsx"
$enc = New-Object System.Text.UTF8Encoding($false)
$content = [System.IO.File]::ReadAllText($path)

# 1. Fix Encoding Corruption
$content = $content.Replace("Ã§", "ç")
$content = $content.Replace("Ã£", "ã")
$content = $content.Replace("Ãµ", "õ")
$content = $content.Replace("Ã¡", "á")
$content = $content.Replace("Ã©", "é")
$content = $content.Replace("Ã­", "í")
$content = $content.Replace("Ã³", "ó")
$content = $content.Replace("Ãº", "ú")
$content = $content.Replace("Ãª", "ê")
$content = $content.Replace("Ã¢", "â")
$content = $content.Replace("Ã°", "ð")
$content = $content.Replace("Ã", "à")
$content = $content.Replace("Âº", "º")

# 2. UI Refinements
# Remove "vs anterior" and similar labels that clutter the KPI descriptions
$content = $content.Replace("vs anterior", "")
$content = $content.Replace("vs ontem", "")

[System.IO.File]::WriteAllText($path, $content, $enc)
