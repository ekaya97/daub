---
id: T-0006
title: "P2: Screen capture + crop"
status: done
priority: high
created: "2026-05-10T11:47:30Z"
created_by: human
claimed_by: null
claimed_at: null
labels:
  - phase-2
  - overlay
branch: null
files: []
depends_on: []
---

## Description

Create overlay/src/capture.ts — initScreenCapture (stream kept alive), grabFrame via video element, html2canvas lazy fallback, cropToElement with innerWidth/innerHeight + DPR. releaseStream on close. See v2 B1-B2

## Work Log