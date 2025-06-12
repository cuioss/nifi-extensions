const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  
  try {
    console.log('Navigating to NiFi...');
    await page.goto('https://localhost:9095/nifi/', { waitUntil: 'networkidle', timeout: 30000 });
    
    console.log('Current URL:', page.url());
    console.log('Page title:', await page.title());
    
    // Check what elements are visible on the page
    console.log('\n--- Main containers ---');
    const containers = await page.$$eval('div[id]', elements => 
      elements.map(el => ({ id: el.id, class: el.className }))
    );
    console.log(containers.slice(0, 10));
    
    // Look for canvas-related elements
    console.log('\n--- Canvas-related elements ---');
    try {
      const canvasElements = await page.$$eval('[id*="canvas"], [class*="canvas"]', elements => 
        elements.map(el => ({ tag: el.tagName, id: el.id, class: el.className }))
      );
      console.log(canvasElements);
    } catch (e) {
      console.log('No canvas elements found');
    }
    
    // Check if there are any login forms
    console.log('\n--- Login forms ---');
    try {
      const loginElements = await page.$$eval('input[type="text"], input[type="password"], input[id*="username"], input[id*="password"]', elements => 
        elements.map(el => ({ type: el.type, id: el.id, name: el.name, placeholder: el.placeholder }))
      );
      console.log(loginElements);
    } catch (e) {
      console.log('No login forms found');
    }
    
    // Check for Angular/NiFi specific elements
    console.log('\n--- NiFi/Angular elements ---');
    try {
      const nifiElements = await page.$$eval('nifi, [class*="nifi"], body > *', elements => 
        elements.map(el => ({ tag: el.tagName, id: el.id, class: el.className }))
      );
      console.log(nifiElements.slice(0, 10));
    } catch (e) {
      console.log('No NiFi elements found');
    }
    
    // Get the complete body content structure
    console.log('\n--- Body structure ---');
    const bodyStructure = await page.evaluate(() => {
      const getElementInfo = (element, depth = 0) => {
        if (depth > 3) return null; // Limit depth
        return {
          tag: element.tagName,
          id: element.id || null,
          class: element.className || null,
          children: Array.from(element.children).map(child => getElementInfo(child, depth + 1)).filter(Boolean)
        };
      };
      return getElementInfo(document.body);
    });
    console.log(JSON.stringify(bodyStructure, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  await browser.close();
})();
