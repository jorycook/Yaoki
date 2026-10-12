#!/bin/bash
# Downloads the two typefaces the build cuts its font files from (both SIL Open Font License 1.1),
# from the Google Fonts repository, into ../fonts-src. About 27 MB. Run once before the first build.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
DEST="${1:-$HERE/../fonts-src}"
BASE="https://raw.githubusercontent.com/google/fonts/main/ofl"
mkdir -p "$DEST/kleeone" "$DEST/mplusrounded1c"
get() { echo "  $1"; curl -fsSL -o "$DEST/$1" "$BASE/$1"; }
get kleeone/KleeOne-Regular.ttf
get kleeone/KleeOne-SemiBold.ttf
get kleeone/OFL.txt
get mplusrounded1c/MPLUSRounded1c-Medium.ttf
get mplusrounded1c/MPLUSRounded1c-Bold.ttf
get mplusrounded1c/MPLUSRounded1c-ExtraBold.ttf
# the files this build was last made from (first 16 characters of each SHA-256)
cat > "$DEST/expected.sha256.txt" <<'EOF'
bf4063f030cc2ae6  kleeone/KleeOne-Regular.ttf
b031ec426c23ca11  kleeone/KleeOne-SemiBold.ttf
c358630584e8e2d8  mplusrounded1c/MPLUSRounded1c-Bold.ttf
8e7c15901dca87f1  mplusrounded1c/MPLUSRounded1c-ExtraBold.ttf
adfde1b6bae58719  mplusrounded1c/MPLUSRounded1c-Medium.ttf
EOF
cd "$DEST"
CHANGED=0
while read -r want file; do
  have="$(sha256sum "$file" | cut -c1-16)"
  if [ "$have" != "$want" ]; then echo "note: $file differs from the copy the last build used (a newer release of the typeface?)"; CHANGED=1; fi
done < expected.sha256.txt
[ "$CHANGED" = 0 ] && echo "typefaces ready in $DEST, same files as the last build"
exit 0
