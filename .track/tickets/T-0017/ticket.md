---
id: T-0017
title: "P5: Wire Copy to Claude button"
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
  - T-0015
  - T-0016
---

## Description

Wire Panel footer Copy button: gather annotated image + after screenshot + CSS delta + notes, generate sessionId (crypto.randomUUID), serialize markdown, call copyToClipboard. Toast on success/failure. Depends on T-0014,T-0015,T-0016

## Work Log