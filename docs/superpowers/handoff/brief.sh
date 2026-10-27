#!/usr/bin/env bash
# usage: bash docs/superpowers/handoff/brief.sh N   (from the repo root)
# Prints the section "任务 N：" of the plan to stdout.
set -euo pipefail
n=$1; PLAN=docs/superpowers/plans/2026-10-21-avatar-admin-frontend.md
tr -d '\r' < "$PLAN" | awk -v n="$n" '
  /^```/ { infence = !infence }
  !infence && /^##?#? / { intask = ($0 ~ ("^###? 任务 " n "：")); if (!intask && started) exit }
  !infence && /^---$/ && started { exit }
  intask { started=1; print }
'
