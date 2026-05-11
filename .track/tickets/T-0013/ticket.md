---
id: T-0013
title: "P4: CSS delta + after screenshot"
status: done
priority: high
created: "2026-05-10T11:48:09Z"
created_by: human
claimed_by: null
claimed_at: null
labels:
  - phase-4
  - overlay
  - core
branch: null
files: []
depends_on:
  - T-0011
---

## Description

Ensure diffStyles normalizes values before comparing (rgb spacing, lowercase hex). Wire EditTab.captureAfterScreenshot on tab switch. Store cssDelta on ElementContext. HMR listener for vite:afterUpdate (v2 F2). Depends on T-0011

## Work Log