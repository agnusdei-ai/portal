#!/bin/sh
# Refuses a tree carrying anything shaped like a live credential. Patterns are
# key shapes, not names, so a placeholder like "sk_test_placeholder" passes
# and a pasted real key does not.
hits=$(git grep -nE \
  'sk_(live|test)_[A-Za-z0-9]{24,}|whsec_[A-Za-z0-9]{24,}|-----BEGIN [A-Z ]*PRIVATE KEY|eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}' \
  -- . ':!package-lock.json')
[ -z "$hits" ] && exit 0
printf '%s\n' "$hits"
echo 'secret-scan: credential-shaped string in the tree' >&2
exit 1
