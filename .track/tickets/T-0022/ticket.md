---
id: T-0022
title: "P7: Next.js adapter — withDaub + write endpoints"
status: done
priority: medium
created: "2026-05-10T11:48:57Z"
created_by: human
claimed_by: null
claimed_at: null
labels:
  - phase-7
  - next
branch: null
files: []
depends_on:
  - T-0017
---

## Description

Implement packages/next/src/index.ts (withDaub webpack entry injection, Turbopack detection+warn), api.ts (Pages Router handler), app-route.ts (App Router handler). Extract shared write logic to core/src/write.ts. Depends on T-0017

## Work Log