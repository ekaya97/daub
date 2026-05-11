---
id: T-0020
title: "P6: Vue + Svelte source resolvers"
status: done
priority: low
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
  - T-0005
---

## Description

Add resolveVue (via __vueParentComponent, file only, line 0) and resolveSvelte (via __svelte_component__, Svelte 4 only, experimental) to overlay/src/source.ts. Already chained via resolveReact ?? resolveVue ?? resolveSvelte. Depends on T-0005

## Work Log