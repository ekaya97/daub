---
id: T-0018
title: "P6: IndexedDB session history"
status: done
priority: medium
created: "2026-05-10T11:48:40Z"
created_by: human
claimed_by: null
claimed_at: null
labels:
  - phase-6
  - overlay
branch: null
files: []
depends_on:
  - T-0017
---

## Description

Create overlay/src/history.ts (idb wrapper) + HistoryTab.ts — save/get/delete sessions, 20-session cap, thumbnail grid, restore on click, clear all. Handle IndexedDB unavailable gracefully. Depends on T-0017

## Work Log