/**
 * PWA icon generation (run `npx pwa-assets-generator`; outputs are committed in public/).
 * Source: public/favicon.svg (the HabitNest nest mark, same art as src/components/common/nest-logo.tsx).
 * File names match the manifest in vite.config.ts and the links in index.html.
 */
import { defineConfig, type AssetType, type ResolvedAssetSize } from '@vite-pwa/assets-generator/config'

const BACKGROUND = '#f3eefc'

function assetName(type: AssetType, size: ResolvedAssetSize): string {
  if (type === 'apple') return 'apple-touch-icon.png'
  if (type === 'maskable') return `pwa-maskable-${size.width}.png`
  return `pwa-${size.width}.png`
}

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    transparent: { sizes: [192, 512], padding: 0.05 },
    // Maskable icons are cropped to a circle/squircle: keep the mark inside the safe zone.
    maskable: { sizes: [512], padding: 0.3, resizeOptions: { background: BACKGROUND } },
    apple: { sizes: [180], padding: 0.2, resizeOptions: { background: BACKGROUND } },
    assetName,
  },
  images: ['public/favicon.svg'],
})
