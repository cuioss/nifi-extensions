#!/bin/bash

# Simplified NiFi Authentication Helper
# This script provides utilities for determining and achieving authentication state
# for both Cypress and Playwright testing

# Configuration
NIFI_BASE_URL="https://localhost:9095"
NIFI_UI_URL="$NIFI_BASE_URL/nifi"
NIFI_API_URL="$NIFI_BASE_URL/nifi-api"

# Function to check if NiFi is accessible
check_nifi_accessibility() {
    echo "Checking NiFi accessibility..."
    
    if curl -s -f "$NIFI_UI_URL/" > /dev/null 2>&1; then
        echo "✅ NiFi UI is accessible at $NIFI_UI_URL"
        return 0
    else
        echo "❌ NiFi UI is not accessible at $NIFI_UI_URL"
        return 1
    fi
}

# Function to determine authentication state
check_authentication_state() {
    echo "Checking authentication state..."
    
    local response=$(curl -s "$NIFI_API_URL/flow/current-user" 2>/dev/null)
    
    if echo "$response" | grep -q '"anonymous":true'; then
        echo "🔓 Anonymous access enabled - no authentication required"
        echo "Current user identity: anonymous"
        return 0
    elif echo "$response" | grep -q '"anonymous":false'; then
        local identity=$(echo "$response" | grep -o '"identity":"[^"]*"' | cut -d'"' -f4)
        echo "🔒 Authenticated access required"
        echo "Current user identity: $identity"
        return 1
    else
        echo "❓ Unable to determine authentication state"
        echo "Response: $response"
        return 2
    fi
}

# Function to check if login is required for UI access
check_ui_login_required() {
    echo "Checking if UI login is required..."
    
    # Check if the main UI loads without login forms
    local ui_content=$(curl -s "$NIFI_UI_URL/" 2>/dev/null)
    
    if echo "$ui_content" | grep -q '<nifi></nifi>' && ! echo "$ui_content" | grep -qi 'login\|username\|password'; then
        echo "✅ UI accessible without login forms"
        return 0
    else
        echo "🔑 Login forms detected in UI"
        return 1
    fi
}

# Function to get authentication strategy recommendation
get_auth_strategy() {
    echo "=== Authentication Strategy Analysis ==="
    
    if ! check_nifi_accessibility; then
        echo "Strategy: Start NiFi first"
        return 1
    fi
    
    if check_authentication_state; then
        echo "Strategy: No authentication needed - direct access"
        echo "Recommendation for tests:"
        echo "  - Cypress: cy.visit('$NIFI_UI_URL') // No login required"
        echo "  - Playwright: await page.goto('$NIFI_UI_URL') // No login required"
        return 0
    else
        if check_ui_login_required; then
            echo "Strategy: UI-based authentication required"
            echo "Recommendation for tests:"
            echo "  - Look for login forms in UI"
            echo "  - Use credentials: admin/adminadminadmin"
        else
            echo "Strategy: Session-based authentication"
            echo "Recommendation for tests:"
            echo "  - May need to establish session first"
        fi
        return 1
    fi
}

# Function to provide simplified login code for Cypress
generate_cypress_code() {
    echo "=== Simplified Cypress Login Code ==="
    
    if check_authentication_state; then
        cat << 'EOF'
// Simplified Cypress login for anonymous access
Cypress.Commands.add('nifiLogin', () => {
  cy.visit('/nifi');
  
  // Wait for Angular app to load
  cy.get('nifi', { timeout: 30000 }).should('exist');
  
  // No authentication required - verify we can access the app
  cy.get('body').should('be.visible');
});

// Verify we're in the main application
Cypress.Commands.add('verifyLoggedIn', () => {
  cy.get('nifi').should('exist');
  cy.url().should('include', '/nifi');
});
EOF
    else
        cat << 'EOF'
// Simplified Cypress login for authenticated access
Cypress.Commands.add('nifiLogin', (username = 'admin', password = 'adminadminadmin') => {
  cy.visit('/nifi');
  
  // Wait for Angular app to load
  cy.get('nifi', { timeout: 30000 }).should('exist');
  
  // Check if login is needed
  cy.get('body').then(($body) => {
    if ($body.find('input[type="password"]').length > 0) {
      // Login form detected - perform authentication
      cy.get('input[type="text"], input[name*="user"]').first().type(username);
      cy.get('input[type="password"]').type(password);
      cy.get('button[type="submit"], button:contains("Login")').click();
      cy.wait(3000);
    }
    // Otherwise already authenticated or anonymous access
  });
});
EOF
    fi
}

# Function to provide simplified login code for Playwright
generate_playwright_code() {
    echo "=== Simplified Playwright Login Code ==="
    
    if check_authentication_state; then
        cat << 'EOF'
// Simplified Playwright login for anonymous access
async function nifiLogin(page) {
  await page.goto('https://localhost:9095/nifi');
  
  // Wait for Angular app to load
  await page.waitForSelector('nifi', { timeout: 30000 });
  
  // No authentication required - verify we can access the app
  await page.waitForLoadState('networkidle');
}

async function verifyLoggedIn(page) {
  const nifiElement = await page.locator('nifi');
  await expect(nifiElement).toBeVisible();
}
EOF
    else
        cat << 'EOF'
// Simplified Playwright login for authenticated access
async function nifiLogin(page, username = 'admin', password = 'adminadminadmin') {
  await page.goto('https://localhost:9095/nifi');
  
  // Wait for Angular app to load
  await page.waitForSelector('nifi', { timeout: 30000 });
  
  // Check if login is needed
  const passwordField = await page.locator('input[type="password"]').first();
  
  if (await passwordField.isVisible()) {
    // Login form detected - perform authentication
    await page.locator('input[type="text"], input[name*="user"]').first().fill(username);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button[type="submit"], button:contains("Login")').click();
    await page.waitForTimeout(3000);
  }
  // Otherwise already authenticated or anonymous access
}
EOF
    fi
}

# Main execution
main() {
    echo "🔍 NiFi Authentication Analysis Tool"
    echo "===================================="
    echo
    
    get_auth_strategy
    echo
    
    generate_cypress_code
    echo
    
    generate_playwright_code
    echo
    
    echo "💡 Additional Recommendations:"
    echo "1. For development/testing: Current HTTP anonymous setup is simplest"
    echo "2. For production-like testing: Configure proper HTTPS authentication"
    echo "3. For MCP Playwright: HTTP anonymous access works perfectly"
    echo "4. For CI/CD: HTTP setup provides fastest and most reliable tests"
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
