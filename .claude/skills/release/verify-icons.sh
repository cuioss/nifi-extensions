#!/usr/bin/env bash
# Release precondition: the custom UI's Font Awesome icons must load.
#
# Regression guard for #600 / #602: index.html once hardcoded font-awesome/7.2.0 while the
# webjar had been bumped to 7.3.0, so both stylesheet links 404'd and the UI had no icons.
# index.html now takes the version from ${version.webjars.font-awesome} via maven-war-plugin
# resource filtering. This script proves that wiring holds in the BUILT WAR.
#
# Usage: verify-icons.sh [path/to/nifi-cuioss-ui.war]   (run from the repository root)
#   default WAR: the single nifi-cuioss-ui/target/nifi-cuioss-ui-*.war
# Optional live check: set NIFI_UI_BASE_URL (e.g. https://localhost:9095/nifi-cuioss-ui) to
# also assert both stylesheets answer HTTP 200 on a running deployment.
#
# Exit 0 = icon fix verified; non-zero = DO NOT RELEASE. Every failed assertion is printed.
set -u

fail=0
ok()   { echo "  OK    $*"; }
bad()  { echo "  FAIL  $*"; fail=1; }

[ -f pom.xml ] || { echo "run from the repository root"; exit 2; }

expected=$(sed -n 's:.*<version.webjars.font-awesome>\(.*\)</version.webjars.font-awesome>.*:\1:p' pom.xml | head -1)
[ -n "$expected" ] || { echo "version.webjars.font-awesome not found in pom.xml"; exit 2; }

war=${1:-}
if [ -z "$war" ]; then
    shopt -s nullglob
    wars=(nifi-cuioss-ui/target/nifi-cuioss-ui-*.war)
    [ "${#wars[@]}" -eq 1 ] || { echo "expected exactly one WAR in nifi-cuioss-ui/target, found ${#wars[@]} (build first)"; exit 2; }
    war=${wars[0]}
fi
[ -f "$war" ] || { echo "WAR not found: $war"; exit 2; }

echo "Icon precondition: Font Awesome $expected (pom.xml) vs $war"

html=$(unzip -p "$war" index.html 2>/dev/null) || { bad "index.html missing from WAR"; exit 1; }

# 1. Resource filtering ran: no unresolved placeholder left in the served page.
if grep -q '\${' <<<"$html"; then bad "index.html still contains an unresolved \${...} placeholder (filtering of index.html is not active)"; else ok "index.html fully filtered (no \${...} left)"; fi

# 2. Every font-awesome link points at the pom's version, and there is at least the two we ship.
links=$(grep -oE 'webjars/font-awesome/[^/"]+/[^"]+' <<<"$html")
count=$(grep -c . <<<"$links")
[ "$count" -ge 2 ] && ok "index.html references $count Font Awesome stylesheets" || bad "expected >= 2 Font Awesome links in index.html, found $count"
wrong=$(grep -vE "^webjars/font-awesome/${expected//./\\.}/" <<<"$links" | grep . || true)
if [ -n "$wrong" ]; then bad "index.html links a version other than $expected:"; sed 's/^/        /' <<<"$wrong"; else ok "all links use $expected"; fi

# 3. Each linked file really exists in the WAR (the actual 404 of #600).
while IFS= read -r link; do
    [ -n "$link" ] || continue
    if unzip -l "$war" "$link" >/dev/null 2>&1; then ok "present in WAR: $link"; else bad "linked but NOT in WAR (would 404): $link"; fi
done <<<"$links"

# 4. The webfonts the CSS refers to ship with the same version (icons are glyphs from these).
if unzip -l "$war" "webjars/font-awesome/$expected/webfonts/*" 2>/dev/null | grep -qE 'fa-(solid|regular|brands)'; then ok "webfonts present for $expected"; else bad "no webfonts under webjars/font-awesome/$expected/ in WAR"; fi

# 5. No stale second Font Awesome version packaged alongside.
others=$(unzip -Z1 "$war" 2>/dev/null | grep -oE '^webjars/font-awesome/[^/]+/' | sort -u | grep -v "^webjars/font-awesome/$expected/\$" || true)
if [ -n "$others" ]; then bad "WAR packages additional Font Awesome version(s): $(tr '\n' ' ' <<<"$others")"; else ok "single Font Awesome version packaged"; fi

# 6. Optional: a running deployment actually serves them.
if [ -n "${NIFI_UI_BASE_URL:-}" ]; then
    while IFS= read -r link; do
        [ -n "$link" ] || continue
        code=$(curl -sk -o /dev/null -w '%{http_code}' "${NIFI_UI_BASE_URL%/}/$link")
        [ "$code" = 200 ] && ok "HTTP 200: $link" || bad "HTTP $code for $link on $NIFI_UI_BASE_URL"
    done <<<"$links"
fi

if [ "$fail" -eq 0 ]; then echo "ICON PRECONDITION: PASS (Font Awesome $expected)"; else echo "ICON PRECONDITION: FAIL"; fi
exit "$fail"
