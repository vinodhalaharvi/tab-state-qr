# Tab State QR 📱

**Capture all your Chrome tabs as a QR code. Scan on any device to restore.**

## Category Theory Architecture

This extension demonstrates the same **Monoid + Folds** pattern from our compositional UI tools:

```
Tabs (Monoid)     →    TabState    →    Multiple Folds (Outputs)
                                        ├─→ toQRCode()      (scannable)
concat(a, b)                            ├─→ toShareURL()    (tabstate://)
empty = {tabs:[]}                       ├─→ toURLList()     (plain text)
                                        ├─→ toJSON()        (full export)
                                        └─→ toBookmarks()   (HTML)
```

### Why Tabs Are Monoids

```javascript
// Identity: Empty tab state
TabStateMonoid.empty = { tabs: [], windows: [], meta: {} }

// Associativity: Order doesn't matter for combining
concat(concat(a, b), c) === concat(a, concat(b, c))

// Closure: Two tab states combine into a tab state
concat(tabsFromWindow1, tabsFromWindow2) → combinedTabState
```

### Folds as Output Generators

One tab selection, multiple synchronized outputs:

| Fold | Output | Use Case |
|------|--------|----------|
| `toCompressed()` | LZ-compressed string | QR codes (size limit ~2KB) |
| `toShareURL()` | `tabstate://...` | Copy/paste sharing |
| `toURLList()` | Plain URLs | Simple text export |
| `toJSON()` | Full state | Backup/restore |
| `toBookmarks()` | Netscape HTML | Import to browser |

### Parsers (Inverse Folds)

Restoring state is the inverse operation:

```
QR Code → parse → TabState → chrome.tabs.create()
```

## Installation

1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `tab-state-qr` folder

## Usage

### Generate QR Code
1. Click the extension icon
2. QR code auto-generates with all tabs
3. **Tabs tab**: Select specific tabs
4. **Copy**: Copy shareable URL
5. **Save**: Download QR as PNG

### Restore Tabs
**On Desktop (with extension):**
1. Click extension → Restore tab
2. Paste the `tabstate://` URL
3. Click "Open Tabs"

**On Mobile/iPad (without extension):**
1. Scan QR code with camera
2. Open the link (goes to restore.html)
3. Review tabs and click "Open"

## Files

```
tab-state-qr/
├── manifest.json      # Extension config
├── popup.html         # Main UI (self-contained)
├── popup.js           # Category theory core (standalone version)
├── restore.html       # Web page for scanning devices
├── pako.min.js        # LZ-String compression
├── qrcode.min.js      # QR generation
└── icons/             # Extension icons
```

## Hosting restore.html

For the QR codes to work on mobile, you need to host `restore.html` somewhere:

1. **GitHub Pages**: Push to repo, enable Pages
2. **Netlify/Vercel**: Drop the file
3. **Your own domain**: `https://yourdomain.com/tabs/`

Then update the share URL in popup.html/popup.js:
```javascript
toShareURL: (state) => `https://yourdomain.com/tabs/#${compressed}`
```

## Technical Notes

### QR Code Size Limits
- QR codes have ~2-3KB practical limit
- We use LZ-String compression (~50% reduction)
- Error correction set to L (low) for max capacity
- ~30-50 URLs typically fit in one QR

### Compression Strategy
```javascript
// Original: ~100 bytes per URL
["https://github.com/...", "https://docs.google.com/...", ...]

// Compressed: ~40-50 bytes per URL
// Base64 URL-safe encoding for QR compatibility
```

### Security
- Extension only accesses `tabs` permission
- No external servers - all processing local
- restore.html runs client-side only

## The Pattern Generalizes

Same architecture works for any "state transfer" problem:

| Domain | State | Folds |
|--------|-------|-------|
| Tabs | URLs + titles | QR, URL list, bookmarks |
| Playlists | Songs + order | QR, Spotify URI, m3u |
| Shopping cart | Items + qty | QR, CSV, share link |
| Form data | Fields + values | QR, JSON, prefilled URL |

The monoid structure ensures:
- **Composability**: Merge states from multiple sources
- **Identity**: Empty state as starting point
- **Associativity**: Order of combination doesn't matter

## License

MIT - Use freely!
