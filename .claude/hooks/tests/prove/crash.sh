#!/usr/bin/env bash
# A stand-in for a previous hook that cannot run (#80): a line on stderr and exit 3, which
# run.sh --prove reports as "the hook exited non-zero (3) at …" with exit 2, never as allow.
echo 'prove/crash: a stub that fails' >&2
exit 3
