# Pixel-Perfect Export QA Test Plan

## Objective
Verify that the pixel-perfect capture implementation:
1. Hides edit icons (delete, color) from the exported preview
2. Accurately captures the canvas at print-quality DPI (300 DPI)
3. Centers content deterministically in all paper formats
4. Matches canvas layout exactly (positions, sizes, colors, connections)

## Prerequisites
- App running: `npm run dev`
- Browser DevTools enabled (F12)
- An org chart loaded or created

## Test Scenarios

### Scenario 1: Basic Preview Capture
**Steps:**
1. Open the app and create/load an org chart with 3-5 blocks
2. Open the Export dialog (File → Export or Export button)
3. Press **F12** to open DevTools
4. Go to **Console** tab
5. Verify logs show:
   - `[ExportWindow] 📸 Capture pixel-perfect du canvas...`
   - `[ExportWindow] 🔧 capture params:` with width, height, scale values
   - `[ExportWindow] ✅ Aperçu pixel-perfect généré:` with byte size

**Expected Results:**
- Console shows capture parameters (scale between 1-4, target pixels calculated)
- Preview displays the canvas content (no white blank screen)
- Preview looks identical to visible canvas (same block positions, colors, connections)
- **Edit icons (delete, color change buttons) are NOT visible in preview**

**Success Criteria:**
- ✓ Logs show successful capture with calculated DPI scale
- ✓ Preview renders content
- ✓ No edit icons visible in preview

---

### Scenario 2: Paper Format Variations
**Setup:** Keep the same org chart

**Test each format:**

#### Test 2a: A4 Portrait
1. Select Format: **A4**
2. Orientation: **Portrait**
3. Observe preview panel
4. Check canvas vs preview alignment
5. Note in console the capture params (target should be ~1181x1676px at 300DPI)

#### Test 2b: A4 Landscape
1. Change Orientation to **Landscape**
2. Observe preview updates
3. Check params in console (target should be ~1676x1181px)

#### Test 2c: A3 (verify larger paper)
1. Select Format: **A3**
2. Test Portrait and Landscape
3. Verify console shows larger target pixels

#### Test 2d: A5 (verify smaller paper)
1. Select Format: **A5**
2. Verify console shows smaller target pixels (~875x1240px)

**Expected Results for All:**
- Preview updates when format/orientation changes
- Console shows correctly calculated target pixel dimensions
- Content fits within preview bounds for all formats
- Canvas and preview appear visually identical
- Scaling is readable (no extreme zooms in or out)

**Success Criteria:**
- ✓ All formats load and show content without white screens
- ✓ Orientation switches update correctly
- ✓ Console params change appropriately for each format

---

### Scenario 3: Edit Icon Hidden Test
**Steps:**
1. Look at the canvas in the main window - you should see:
   - Small delete icons (X button) on each block
   - Color change buttons if implemented
2. Open Export dialog
3. Look at the preview panel
4. **Edit icons should NOT be visible in preview**

**Visual Comparison:**
| Canvas | Preview |
|--------|---------|
| Has delete icon (X) on blocks | No delete icon visible |
| May have color button | No color button visible |
| Shows contact info | Shows same contact info |
| Shows connections | Shows same connections |

**Success Criteria:**
- ✓ Canvas clearly shows edit icons over blocks
- ✓ Preview shows identical blocks but WITHOUT the edit icons
- ✓ All other content (names, titles, connections) matches exactly

---

### Scenario 4: Complex Org Chart Test
**Steps:**
1. Create an org chart with:
   - 10+ blocks
   - Multiple hierarchy levels (3+ levels deep)
   - Various block colors (if features colors)
   - Long names or titles (word wrap test)
   - Multiple connection paths
2. Open Export dialog with F12 console open
3. Switch between formats: A2, A3, A4
4. Watch console for successful captures

**Expected Results:**
- All blocks render in preview (none cut off)
- Hierarchy relationships shown (connections visible)
- Long text wraps appropriately
- Colors match canvas exactly
- **Edit icons invisible in preview**
- Console shows successful captures for each format

**Success Criteria:**
- ✓ Complex layout renders fully in preview
- ✓ No missing content
- ✓ Colors accurate
- ✓ Edit icons hidden

---

### Scenario 5: DPI Scale Validation
**In DevTools Console, verify capture math:**

Expected calculations for A4 with 300 DPI:
```
A4 dimensions: 210mm × 297mm
DPI: 300 pixels/inch
Conversion: 300 / 25.4 = 11.81 px/mm

Target pixels:
- Width: 210 × 11.81 ≈ 2480px
- Height: 297 × 11.81 ≈ 3508px

Console should show approximately:
{ targetWidthPx: 2480, targetHeightPx: 3508, ... }
```

1. Open Export dialog with A4 Portrait selected
2. Press F12 → Console
3. Look for line: `[ExportWindow] 🔧 capture params: {`
4. Verify values match calculation above
5. Test with other formats and verify math

**Success Criteria:**
- ✓ Capture params match expected pixel calculations
- ✓ Scale is between 1 and 4 (reasonable rendering scale)
- ✓ No extreme scale values (>4 indicates problem)

---

### Scenario 6: Export and Save Test
**Steps:**
1. Set up export dialog with desired format
2. Click **Export/Save** button (if implemented)
3. Select save location
4. Open the saved image file:
   - If PNG: use image viewer
   - If JPEG: use image viewer
   - If PDF/SVG: use appropriate viewer
5. Compare saved image to canvas

**In Image Viewer:**
- Dimensions should match target paper size at 300 DPI
- Content should be vertically/horizontally centered
- **No edit icons visible**
- Colors accurate
- Text readable
- All blocks and connections present

**Success Criteria:**
- ✓ File saves successfully
- ✓ File dimensions match target (210×297mm → ~2480×3508px at 300DPI)
- ✓ Content matches canvas exactly (no icons, same positions/colors)
- ✓ Image quality is good (no pixelation, sharp text)

---

## Console Log Reference

### Successful Flow
```
[ExportWindow] 🟢 Dialog ouverte - Démarrage du polling
[ExportWindow] 🔍 Début génération aperçu...
[ExportWindow] ✅ Conteneur du canvas trouvé
[ExportWindow] 📸 Capture pixel-perfect du canvas...
[ExportWindow] 🔧 capture params: { 
  targetWidthPx: 2480, 
  targetHeightPx: 3508, 
  elementWidth: 800, 
  elementHeight: 1144, 
  scale: 3.1
}
[ExportWindow] ✅ Aperçu pixel-perfect généré: 1245832 bytes
```

### Potential Issues & Solutions

| Log Message | Meaning | Action |
|-------------|---------|--------|
| `captureElement manquant` | Canvas DOM not found | Check SVG is rendered; reload page |
| `scale` >4 | Extreme DPI requirement | Paper format too large or canvas too small; check layout |
| `scale` <1 | Downscaling needed | Normal for small papers (A5); acceptable |
| Preview blank white | Capture succeeded but image empty | Check canvas has content; verify layout calculated |
| Edit icons visible in preview | Icon hiding failed | Check CSS selectors match actual DOM classes |

---

## Validation Checklist

- [ ] App starts and runs without errors
- [ ] Export dialog opens successfully
- [ ] Console shows `[ExportWindow]` logs
- [ ] Preview displays canvas content
- [ ] Pixel-perfect capture logs appear
- [ ] Edit icons NOT visible in preview
- [ ] Multiple formats (A4, A3, A5) work
- [ ] Portrait and Landscape switch properly
- [ ] DPI calculations are correct in console
- [ ] Canvas and preview look identical (except no icons)
- [ ] Complex org charts render fully
- [ ] Export/Save function works (if implemented)
- [ ] Saved image matches preview

---

## Debugging Tips

**If preview is blank:**
1. Check canvas has content (visible in main window)
2. Open DevTools → Elements tab
3. Find `<svg data-orgchart-canvas>`
4. Verify it has `<g>` children (blocks and connections)
5. Check parent div for `style*="transform"` (zoom/pan)

**If edit icons appear in preview:**
1. Inspect an icon in DevTools (right-click → Inspect)
2. Note the exact CSS class(es)
3. Add to `HIDE_SELECTORS` array in ExportWindow.jsx
4. Example: if class is `.edit-btn`, add `'.edit-btn'` to array

**If scale is wrong:**
1. Check paper format dimensions in PAPER_FORMATS object
2. Verify TARGET_DPI = 300 is correct
3. Manually calculate expected pixels: `format_mm × (300/25.4)`
4. Compare to console log value

---

## Final Sign-Off

When all tests pass:
- [ ] Pixel-perfect capture is **working correctly**
- [ ] Edit icons are **successfully hidden**
- [ ] Canvas and preview are **pixel-perfect matches** (except icons)
- [ ] All paper formats and orientations **function properly**
- [ ] Export output quality is **suitable for printing**

**Status:** Ready for production ✓
