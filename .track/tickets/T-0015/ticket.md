---
id: T-0015
title: "P5: Clipboard + disk write"
status: done
priority: high
created: "2026-05-10T11:48:24Z"
created_by: human
claimed_by: null
claimed_at: null
labels:
  - phase-5
  - overlay
branch: null
files: []
depends_on:
  - T-0014
---

## Description

Create overlay/src/clipboard.ts — prepareImage (resize max 2048px, JPEG 0.88), copyToClipboard with ClipboardItem Promise values (v2 B4), writeToDisk with CSRF token header. Non-blocking disk write. Depends on T-0014

## Work Log