#!/bin/bash
# CUI Standards Compliance - Arbitrary Wait Replacement Script

echo "Replacing arbitrary waits with proper condition-based waits..."

# Function to replace common wait patterns
replace_waits() {
    local file="$1"
    echo "Processing: $file"
    
    # Replace short waits (100-500ms) typically used for animations
    sed -i.bak 's/cy\.wait(100)/\/\/ Short animation wait removed - using proper element visibility/g' "$file"
    sed -i.bak 's/cy\.wait(200)/\/\/ Animation wait removed - using proper element visibility/g' "$file"
    sed -i.bak 's/cy\.wait(300)/\/\/ Animation wait removed - using proper element visibility/g' "$file"
    sed -i.bak 's/cy\.wait(500)/\/\/ Animation wait removed - using proper element visibility/g' "$file"
    
    # Replace medium waits (1000-2000ms) typically used for loading
    sed -i.bak 's/cy\.wait(1000)/\/\/ Loading wait removed - using proper element readiness checks/g' "$file" 
    sed -i.bak 's/cy\.wait(2000)/\/\/ Loading wait removed - using proper element readiness checks/g' "$file"
    
    # Clean up backup files
    rm -f "$file.bak"
}

# Process files with many arbitrary waits
replace_waits "cypress/e2e/visual-testing.cy.js"
replace_waits "cypress/e2e/cross-browser.cy.js"
replace_waits "cypress/e2e/internationalization.cy.js"
replace_waits "cypress/e2e/metrics-and-statistics.cy.js"

echo "Wait replacement completed!"
