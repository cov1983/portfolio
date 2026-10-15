# The ice texture's source

`src/world/scene/ice.webp`, the World's ice (#55), is derived from this photo:

- **Photo:** "A person playing hockey", https://www.pexels.com/photo/a-person-playing-hockey-6557325/
- **Photographer:** cottonbro studio, https://www.pexels.com/@cottonbro/
- **License:** Pexels License, https://www.pexels.com/license/. Free to use and modify, no
  attribution required; the photo may not be redistributed on stock or wallpaper platforms.

**The crop.** The upper scratch area of the full photo, about 1427 × 471 px, with no people in
it, saved as `assets/ice/Ice-surface-2-reduced.jpg`. The crop is **not committed**
(`.gitignore`: `assets/ice/*.jpg`); only the processed texture is. LICENSE section 4 names the
texture's terms.

**The processing.** `make ice-texture` runs `scripts/ice-texture.ts` (sharp; the pixel steps are
the pure functions of `scripts/ice/process.ts`):

1. crop the top 24 rows, which hold faint specks at the top right;
2. remove the low-frequency brightness: subtract the luma blurred with σ ≈ 40 px (three box passes
   of radius 40) and add back its mean, so the photo's soft light does not show as bands where the
   tile repeats; the skate marks, 1–6 px wide, stay;
3. desaturate and pull towards the ice colour `#eef4f8`, keeping 0.7 of the skate marks' contrast;
4. blend 64 px at the edges on both axes, so the tile repeats without a seam;
5. export WebP at quality 80, effort 6; the script fails above 150,000 B.

**To re-run it**, download the photo from the link above, crop the area described, save it as
`assets/ice/Ice-surface-2-reduced.jpg` and run `make ice-texture` in the devcontainer. Without the
file the script stops and points here.
