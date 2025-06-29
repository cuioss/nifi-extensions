# Phase 0: NiFi DOM Structure Analysis - CRITICAL FOUNDATION

## 🚨 ABSOLUTE PRIORITY - MUST COMPLETE FIRST

**This analysis is the foundation for everything else. No other work can proceed until this is complete.**

## Prerequisites ✅

- [x] NiFi container environment running via `./integration-testing/src/main/docker/run-test-container.sh`
- [x] NiFi accessible at https://localhost:9095/nifi
- [x] Test credentials available:
  - Test user: `testUser` / password: `drowssap`
  - Keycloak realm: `oauth_integration_tests`

## Manual Analysis Required

**Open https://localhost:9095/nifi in your browser and use Developer Tools (F12) to inspect the actual DOM structure.**

## 1. Canvas Structure Analysis

### 1.1 Main Canvas Container
**Task**: Find the main canvas container element

**Instructions**:
1. Open https://localhost:9095/nifi
2. Log in with testUser/drowssap
3. Open Developer Tools (F12)
4. Look for the main canvas area where processors would be placed
5. Right-click on the canvas area and select "Inspect Element"

**Document Here**:
```
Main Canvas Container:
- Element tag: _______________
- ID attribute: _______________
- Class attributes: _______________
- Parent element: _______________
- Full selector path: _______________
```

### 1.2 Canvas SVG Element
**Task**: Find the SVG element used for drawing the flow

**Instructions**:
1. Within the canvas container, look for SVG elements
2. Identify which SVG is used for the main drawing area
3. Note any nested groups or layers within the SVG

**Document Here**:
```
Canvas SVG:
- Element tag: _______________
- ID attribute: _______________
- Class attributes: _______________
- Parent selector: _______________
- Full selector path: _______________
- Nested groups: _______________
```

### 1.3 Canvas Interaction Area
**Task**: Identify the clickable area for canvas operations

**Instructions**:
1. Try right-clicking on empty canvas space
2. Try double-clicking on empty canvas space
3. Note which element receives these events

**Document Here**:
```
Canvas Interaction Element:
- Element that receives right-clicks: _______________
- Element that receives double-clicks: _______________
- Coordinates system used: _______________
```

## 2. Toolbar Analysis

### 2.1 Add Processor Button
**Task**: Find the "Add Processor" button in the toolbar

**Instructions**:
1. Look for toolbar at the top of the NiFi interface
2. Find the button used to add processors
3. Note its exact selector and any hover states

**Document Here**:
```
Add Processor Button:
- Element tag: _______________
- ID attribute: _______________
- Class attributes: _______________
- Text content: _______________
- Title/tooltip: _______________
- Full selector path: _______________
- Hover state classes: _______________
```

### 2.2 Other Toolbar Elements
**Task**: Document other relevant toolbar buttons

**Instructions**:
1. Identify other processor-related buttons
2. Note any dropdown menus or sub-toolbars

**Document Here**:
```
Other Toolbar Elements:
- Delete button: _______________
- Start/Stop buttons: _______________
- Configuration buttons: _______________
```

## 3. Add Processor Dialog Analysis

### 3.1 Opening the Dialog
**Task**: Determine how to open the Add Processor dialog

**Instructions**:
1. Try clicking the Add Processor toolbar button
2. Try right-clicking on canvas and look for context menu
3. Try double-clicking on canvas
4. Document which method actually works

**Document Here**:
```
Add Processor Dialog Opening:
- Method that works: _______________
- Button/element clicked: _______________
- Any intermediate steps: _______________
```

### 3.2 Dialog Structure
**Task**: Analyze the Add Processor dialog DOM structure

**Instructions**:
1. Open the Add Processor dialog using the working method
2. Inspect the dialog element structure
3. Find the processor type list
4. Find the search input field
5. Find the Add/Cancel buttons

**Document Here**:
```
Add Processor Dialog:
- Dialog container: _______________
- Dialog ID/classes: _______________
- Processor type list container: _______________
- Individual processor type items: _______________
- Search input field: _______________
- Add button: _______________
- Cancel button: _______________
```

### 3.3 Processor Type List
**Task**: Analyze how processor types are displayed

**Instructions**:
1. Look for JWT processors in the list
2. Note the structure of each processor type item
3. Check if search filtering works

**Document Here**:
```
Processor Type List:
- List container element: _______________
- Individual item structure: _______________
- Processor name display: _______________
- Processor description display: _______________
- Selection mechanism: _______________
- Search behavior: _______________

JWT Processors Found:
- JWTTokenAuthenticator: _______________
- MultiIssuerJWTTokenAuthenticator: _______________
```

## 4. Processor Elements on Canvas

### 4.1 Processor Placement
**Task**: Add a processor and analyze its DOM structure

**Instructions**:
1. Successfully add a JWT processor to the canvas
2. Inspect the processor element that appears
3. Note its position, size, and structure

**Document Here**:
```
Processor on Canvas:
- Container element: _______________
- Processor ID attribute: _______________
- Processor classes: _______________
- Position attributes: _______________
- Size attributes: _______________
- Text/label elements: _______________
- Icon elements: _______________
```

### 4.2 Processor Selection
**Task**: Analyze how processors are selected

**Instructions**:
1. Click on the processor to select it
2. Note any visual changes or class additions
3. Try multi-selection if possible

**Document Here**:
```
Processor Selection:
- Selection classes added: _______________
- Visual indicators: _______________
- Selection mechanism: _______________
```

### 4.3 Processor Context Menu
**Task**: Analyze processor right-click menu

**Instructions**:
1. Right-click on a processor
2. Look for context menu options
3. Find the delete/remove option

**Document Here**:
```
Processor Context Menu:
- Context menu container: _______________
- Menu item structure: _______________
- Delete/Remove option: _______________
- Other relevant options: _______________
```

## 5. Processor Removal Analysis

### 5.1 Deletion Process
**Task**: Document how to delete a processor

**Instructions**:
1. Try different methods to delete a processor:
   - Context menu delete
   - Select and press Delete key
   - Toolbar delete button
2. Note any confirmation dialogs

**Document Here**:
```
Processor Deletion:
- Working deletion method: _______________
- Confirmation dialog: _______________
- Confirmation button selectors: _______________
```

## 6. Wait Conditions and Timing

### 6.1 Loading States
**Task**: Identify loading indicators and wait conditions

**Instructions**:
1. Note any loading spinners or indicators
2. Observe timing for dialog appearances
3. Check for any async operations

**Document Here**:
```
Loading and Timing:
- Dialog appearance time: _______________
- Processor placement time: _______________
- Loading indicators: _______________
- Required wait conditions: _______________
```

## 7. Validation Checklist

**Complete this checklist to verify Phase 0 is done:**

- [ ] Canvas container selector documented and verified
- [ ] Canvas SVG selector documented and verified
- [ ] Add Processor button selector documented and verified
- [ ] Add Processor dialog opening method documented and working
- [ ] Add Processor dialog structure completely mapped
- [ ] Processor type list structure documented
- [ ] JWT processors found and selectable in dialog
- [ ] Processor placement on canvas documented
- [ ] Processor selection mechanism documented
- [ ] Processor deletion method documented and working
- [ ] All selectors tested and verified to work
- [ ] Wait conditions and timing documented

## 8. Next Steps

**Only after completing ALL items above:**

1. Update `cypress/support/constants.js` with REAL selectors
2. Update `cypress/support/utils.js` with REAL canvas detection
3. Update `cypress/support/processor-helper.js` with REAL operations
4. Remove all assumptions and workarounds
5. Test with real NiFi instance

## 🚨 CRITICAL REMINDER

**This analysis cannot be skipped or shortcut. Every selector must be verified against the actual running NiFi instance. No assumptions allowed.**

**The entire framework depends on getting this right.**