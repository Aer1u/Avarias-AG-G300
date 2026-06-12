$path = "c:\Users\Pichau\OneDrive\documentos\big\Avarias-AG-G300-main (14)\Avarias-AG-G300-main\src\app\page.tsx"
$content = Get-Content $path
$newContent = @()
$skip = $false
$skippedOnce = $false

foreach ($line in $content) {
    # Define topSkus
    if ($line -like "*topSkusFilter, topSkusSort])*") {
        $newContent += $line
        $newContent += ""
        $newContent += "  const topSkus = advancedStats.top10Skus; // Fix ReferenceError"
        continue
    }

    # Handle duplicate block removal (L2824-3021)
    if ($line -like "*Divergence Tracking Panel*" -and -not $skippedOnce) {
        $skip = $true
        $skippedOnce = $true
        continue
    }
    
    if ($skip) {
        if ($line -like "*<AnimatePresence mode=`"wait`">*") {
            $skip = $false
            # Don't continue, we need to add this line and continue processing
        } else {
            continue
        }
    }

    # Optimization: Compact History Card
    # Remove labels per user dislike
    if ($line -like "*vs anterior*")      { $newContent += $line -replace "vs anterior", ""; continue }
    if ($line -like "*vs ontem*")         { $newContent += $line -replace "vs ontem", ""; continue }

    $newContent += $line
}

$newContent | Set-Content $path -Encoding UTF8
