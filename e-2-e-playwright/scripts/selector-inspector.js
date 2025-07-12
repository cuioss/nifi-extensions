/**
 * Selector Inspector - Debug script to find correct selectors
 * Run this script to inspect the NiFi UI and find the correct selectors
 */

const { chromium } = require('playwright');
const path = require('path');

async function inspectSelectors() {
  console.log('🔍 Starting selector inspection...');
  
  const browser = await chromium.launch({ 
    headless: false,
    ignoreHTTPSErrors: true,
    args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
  });
  
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  try {
    // Navigate to NiFi
    console.log('🔄 Navigating to NiFi...');
    await page.goto('https://localhost:9095/nifi', { waitUntil: 'networkidle' });
    
    // Check if we need to login
    const loginInput = await page.$('input[type="password"]');
    if (loginInput) {
      console.log('🔐 Logging in...');
      await page.fill('input[type="text"]', 'testUser');
      await page.fill('input[type="password"]', 'drowssap');
      await page.click('button[type="submit"], input[value="Login"]');
      await page.waitForTimeout(3000);
    }
    
    // Wait for canvas to load
    console.log('⏳ Waiting for canvas...');
    await page.waitForSelector('mat-sidenav-content, #canvas-container', { timeout: 10000 });
    
    // Take a screenshot for reference
    await page.screenshot({ path: path.join(__dirname, '../target/screenshots/selector-inspection.png') });
    
    // Find all buttons and their attributes
    console.log('🔍 Analyzing toolbar buttons...');
    const buttons = await page.$$('button');
    
    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i];
      try {
        const isVisible = await button.isVisible();
        if (isVisible) {
          const title = await button.getAttribute('title') || '';
          const ariaLabel = await button.getAttribute('aria-label') || '';
          const className = await button.getAttribute('class') || '';
          const id = await button.getAttribute('id') || '';
          const text = await button.textContent() || '';
          
          if (title.toLowerCase().includes('processor') || 
              ariaLabel.toLowerCase().includes('processor') || 
              className.includes('processor') ||
              text.toLowerCase().includes('processor')) {
            console.log(`🎯 PROCESSOR BUTTON FOUND [${i}]:`);
            console.log(`   Title: "${title}"`);
            console.log(`   Aria-Label: "${ariaLabel}"`);
            console.log(`   Class: "${className}"`);
            console.log(`   ID: "${id}"`);
            console.log(`   Text: "${text}"`);
            console.log(`   Selector: button:nth-child(${i+1})`);
            console.log('');
          }
        }
      } catch (error) {
        // Skip buttons that can't be inspected
      }
    }
    
    // Look for drag-and-drop elements
    console.log('🎯 Looking for drag-and-drop elements...');
    const dragElements = await page.$$('[draggable="true"], .cdk-drag, [cdkdrag]');
    
    for (let i = 0; i < dragElements.length; i++) {
      const element = dragElements[i];
      try {
        const isVisible = await element.isVisible();
        if (isVisible) {
          const title = await element.getAttribute('title') || '';
          const ariaLabel = await element.getAttribute('aria-label') || '';
          const className = await element.getAttribute('class') || '';
          const tagName = await element.evaluate(el => el.tagName);
          const text = await element.textContent() || '';
          
          console.log(`🎯 DRAG ELEMENT FOUND [${i}]:`);
          console.log(`   Tag: ${tagName}`);
          console.log(`   Title: "${title}"`);
          console.log(`   Aria-Label: "${ariaLabel}"`);
          console.log(`   Class: "${className}"`);
          console.log(`   Text: "${text}"`);
          console.log('');
        }
      } catch (error) {
        // Skip elements that can't be inspected
      }
    }
    
    // Look for canvas elements
    console.log('🎯 Analyzing canvas elements...');
    const canvasElements = await page.$$('#canvas-container, mat-sidenav-content, svg');
    
    for (const element of canvasElements) {
      try {
        const isVisible = await element.isVisible();
        if (isVisible) {
          const tagName = await element.evaluate(el => el.tagName);
          const id = await element.getAttribute('id') || '';
          const className = await element.getAttribute('class') || '';
          
          console.log(`🎯 CANVAS ELEMENT:`);
          console.log(`   Tag: ${tagName}`);
          console.log(`   ID: "${id}"`);
          console.log(`   Class: "${className}"`);
          console.log('');
        }
      } catch (error) {
        // Skip elements that can't be inspected
      }
    }
    
    console.log('✅ Selector inspection complete!');
    console.log('📸 Screenshot saved to: target/screenshots/selector-inspection.png');
    console.log('');
    console.log('🔍 Manual testing instructions:');
    console.log('1. The browser window will stay open');
    console.log('2. Manually test the drag-and-drop functionality');
    console.log('3. Use browser DevTools to inspect elements');
    console.log('4. Look for the correct selectors in the console output above');
    console.log('5. Press Ctrl+C to close when done');
    
    // Keep the browser open for manual inspection
    await page.waitForTimeout(300000); // Wait 5 minutes
    
  } catch (error) {
    console.error('❌ Error during inspection:', error);
    await page.screenshot({ path: path.join(__dirname, '../target/screenshots/selector-inspection-error.png') });
  } finally {
    await browser.close();
  }
}

// Run the inspection
inspectSelectors().catch(console.error);