#!/bin/bash

# Fix CSS Standards Script
# Automatically fixes common CUI CSS standards violations

echo "🎨 Fixing CSS Standards Violations..."

# Get CSS files
CSS_FILES=$(find src/main/webapp/css -name "*.css" -type f)

for file in $CSS_FILES; do
    echo "Processing: $file"
    
    # Fix hex color length (#ffffff -> #fff)
    sed -i '' 's/#ffffff/#fff/g' "$file"
    sed -i '' 's/#000000/#000/g' "$file"
    
    # Fix named colors to hex
    sed -i '' 's/color: white/color: #fff/g' "$file"
    sed -i '' 's/color: black/color: #000/g' "$file"
    sed -i '' 's/background: white/background: #fff/g' "$file"
    sed -i '' 's/background: black/background: #000/g' "$file"
    sed -i '' 's/background-color: white/background-color: #fff/g' "$file"
    sed -i '' 's/background-color: black/background-color: #000/g' "$file"
    
    # Fix rgba to rgb and modern notation
    sed -i '' 's/rgba(\([0-9]*\), *\([0-9]*\), *\([0-9]*\), *0\.8)/rgb(\1 \2 \3 \/ 80%)/g' "$file"
    sed -i '' 's/rgba(\([0-9]*\), *\([0-9]*\), *\([0-9]*\), *0\.5)/rgb(\1 \2 \3 \/ 50%)/g' "$file"
    sed -i '' 's/rgba(\([0-9]*\), *\([0-9]*\), *\([0-9]*\), *0\.3)/rgb(\1 \2 \3 \/ 30%)/g' "$file"
    sed -i '' 's/rgba(\([0-9]*\), *\([0-9]*\), *\([0-9]*\), *0\.1)/rgb(\1 \2 \3 \/ 10%)/g' "$file"
    
    # Fix camelCase keyframes to kebab-case
    sed -i '' 's/@keyframes fadeInOut/@keyframes fade-in-out/g' "$file"
    sed -i '' 's/@keyframes slideInLeft/@keyframes slide-in-left/g' "$file"
    sed -i '' 's/@keyframes slideInRight/@keyframes slide-in-right/g' "$file"
    sed -i '' 's/animation: fadeInOut/animation: fade-in-out/g' "$file"
    sed -i '' 's/animation: slideInLeft/animation: slide-in-left/g' "$file"
    sed -i '' 's/animation: slideInRight/animation: slide-in-right/g' "$file"
    
    echo "  ✅ Fixed common issues in $file"
done

echo "🎯 Running stylelint auto-fix..."
npm run stylelint:fix

echo "📊 Checking remaining violations..."
VIOLATIONS=$(npm run stylelint 2>&1 | grep -E "✖" | wc -l | xargs)
echo "Remaining violations: $VIOLATIONS"

echo "✅ CSS Standards fixing completed!"
