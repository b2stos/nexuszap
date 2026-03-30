

# Diagnostic Report: Campaign Flow — "Sent 2/2, Delivered 0, Failed 0"

## Root Cause (confirmed from logs)

**The webhook is arriving with the WRONG channel_id (`da4ee479-...`), but the campaign was sent via channel `e4d9f70c-...`.**

The edge function logs prove this:

```
[Webhook] Extracted channel_id from query: da4ee479-6021-4b41-9c90-ca7d877d50d2
Channel not found — error: "Cannot coerce the result to a single JSON object"
```

Meanwhile the campaign used:
```
Channel: B2 Digital (e4d9f70c-0b84-47ce-927c-59d6e30207eb)
```

This means the NotificaMe webhook URL configured in the Meta/NotificaMe dashboard is pointing to an OLD or WRONG channel UUID. Every status event (SENT, DELIVERED, READ) arrives, gets logged as "Channel not found", and is **silently discarded** — no status is ever written to `campaign_recipients` or `mt_messages`.

### Evidence chain:
1. **Send: OK** — campaign-process-queue logs show HTTP 200, `provider_message_id` saved correctly for both recipients.
2. **Webhook: BROKEN** — All 4+ webhook events arrive with `channel_id=da4ee479-...` which does NOT exist in `channels` table (it was likely a previous/deleted channel).
3. **Status update: NEVER RUNS** — Because channel lookup fails at line 1528 (`.single()` returns no rows), the function returns 200 without processing.
4. **Result** — `campaign_recipients` stay at `sent`, counters never update to `delivered`/`read`.

## Secondary Issue: Inbox filter hides campaign conversations

The Inbox defaults to `repliedOnly: true` (line 139). Campaign-generated conversations have `last_inbound_at = null` (no inbound message yet), so they're **filtered out** by default. Users must click "Todas" to see them.

## Fixes Required

### Fix 1 — Update webhook URL in NotificaMe dashboard (MANUAL)
The webhook URL configured in NotificaMe must use the CORRECT channel_id:
```
https://xaypooqwcrhytkfqyzha.supabase.co/functions/v1/webhook-notificame?channel_id=e4d9f70c-0b84-47ce-927c-59d6e30207eb
```
Replace the old `da4ee479-...` UUID with the active channel UUID `e4d9f70c-...`.

### Fix 2 — Add subscription_id fallback to webhook handler (CODE)
Currently, when the channel_id from the URL is wrong, the webhook tries to extract `subscriptionId` from the body but only when `channelId` is null. Since `da4ee479-...` IS a valid UUID (just not in the DB), this fallback never triggers.

**Change**: When the channel DB lookup fails (line 1530), attempt a fallback lookup by `subscription_id` from the webhook body before giving up.

In `webhook-notificame/index.ts`, after the channel lookup fails:
- Extract `subscriptionId` from body (`e3e10523-a136-418c-b679-d1ad2c80148b`)
- Query `channels` where `provider_config->>subscription_id = subscriptionId`
- If found, use that channel instead of returning early

### Fix 3 — Change Inbox default filter (CODE)
Change `repliedOnly` default from `true` to `false` so campaign-generated conversations are visible immediately.

## Answer: Can you safely send 250 messages now?

**NO.** The webhook URL mismatch means ALL 250 messages would show "Sent" but never "Delivered" or "Read". You'd have zero delivery visibility.

**Before scaling:**
1. Fix the webhook URL in NotificaMe dashboard (immediate, manual)
2. Deploy the subscription_id fallback (prevents this from recurring)
3. Send a 2-contact test campaign and confirm DELIVERED/READ status updates appear within 60 seconds

## Technical Details

| File | Change |
|------|--------|
| `supabase/functions/webhook-notificame/index.ts` | Add subscription_id fallback when channel lookup by UUID fails (lines 1514-1536) |
| `src/pages/Inbox.tsx` | Change `repliedOnly: true` to `repliedOnly: false` on line 139 |

### DOM nesting warning (minor)
Console shows `<button> cannot appear as descendant of <button>` in `SwipeableConversationItem.tsx`. This is cosmetic but should be fixed by changing the inner delete button to a `<div role="button">`.

