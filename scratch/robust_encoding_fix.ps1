$path = "c:\Users\Pichau\OneDrive\documentos\big\Avarias-AG-G300-main (14)\Avarias-AG-G300-main\src\app\page.tsx"
$bytes = [System.IO.File]::ReadAllBytes($path)

# If it's UTF-8 with BOM, skip it
if ($bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    # Already UTF-8 BOM, we might want to keep it or convert to No BOM
}

# The problem is likely that UTF-8 bytes were written as if they were single-byte chars.
# e.g. "ç" (C3 A7) became "Ã§" (C3 83 C2 A7 ?? No, usually just C3 A7 interpreted incorrectly).

$text = [System.IO.File]::ReadAllText($path)
# Clean up most obvious corruptions
$corrections = @{
    "Ã§" = "ç";
    "Ã£" = "ã";
    "Ãµ" = "õ";
    "Ã¡" = "á";
    "Ã©" = "é";
    "Ã­" = "í";
    "Ã³" = "ó";
    "Ãº" = "ú";
    "Ãª" = "ê";
    "Ã¢" = "â";
    "Ã€" = "À";
    "Ã…" = "…";
    "Ã" = "à";
    "Âº" = "º";
    "Âª" = "ª"
}

foreach ($key in $corrections.Keys) {
    $text = $text.Replace($key, $corrections[$key])
}

[System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($false)))
