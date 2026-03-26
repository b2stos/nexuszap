

# Fix: Error 131053 — Static media headers must NOT send media

## Root Cause

The `resolveTemplateMediaHeader` and `validatePayloadAgainstContract` functions treat ALL `image/video/document` headers the same. But **static** media headers (like `rpg5`) have the image already stored by Meta — sending a media URL causes error 131053 because Meta tries to download an expired sample URL.

The `contract.header.isMediaStatic` flag exists and is correctly set to `true` for these templates, but it's **never checked** in either function.

## Fix (2 changes in `campaign-process-queue/index.ts`)

### 1. `resolveTemplateMediaHeader` — return `not_required` for static media

At line 384, change:
```typescript
if (!['image', 'video', 'document'].includes(headerType)) {
```
to:
```typescript
if (!['image', 'video', 'document'].includes(headerType) || contract.header.isMediaStatic) {
```

When `isMediaStatic = true`, the function returns `{ media: null, source: 'not_required' }` — no media sent.

### 2. `validatePayloadAgainstContract` — skip media requirement for static headers

At line 518, change:
```typescript
const requiresMediaHeader = ['image', 'video', 'document'].includes(contract.header.type);
```
to:
```typescript
const requiresMediaHeader = ['image', 'video', 'document'].includes(contract.header.type) && !contract.header.isMediaStatic;
```

Static media headers pass validation without needing a media reference.

## Result

- `rpg5` (static IMAGE, no text vars, static button): sends payload with **zero components** — no media, no body params, no button params.
- Templates with dynamic IMAGE headers (`{{1}}` in header text): still require and send media URL.
- No other files need changes.

