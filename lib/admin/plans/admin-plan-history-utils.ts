export type PlanHistoryEventType =
  | "PLAN_CREATED"
  | "PLAN_UPDATED"
  | "PLAN_ACTIVATED"
  | "PLAN_ARCHIVED"
  | "PLAN_CLONED"
  | "PLAN_PRICE_CREATED"
  | "PLAN_PRICE_PUBLISHED"
  | "PLAN_PRICE_EXPIRED"
  | "PLAN_PRICE_ARCHIVED"
  | "PLAN_FEATURE_CREATED"
  | "PLAN_FEATURE_UPDATED"
  | "PLAN_FEATURE_VISIBILITY_CHANGED"
  | "PLAN_FEATURE_HIGHLIGHT_CHANGED"
  | "PLAN_FEATURE_REORDERED"
  | "PLAN_FEATURE_DELETED"
  | "PLAN_ENTITLEMENT_PUBLISHED"
  | "ADMIN_PLAN_NOTE_CREATED"
  | "ADMIN_PLAN_NOTE_UPDATED"
  | "ADMIN_PLAN_NOTE_PINNED"
  | "ADMIN_PLAN_NOTE_UNPINNED"
  | "ADMIN_PLAN_NOTE_DELETED";

export type PlanHistoryEvent = {
  eventId: string;
  occurredAt: string;
  eventType: PlanHistoryEventType | string;
  source: "AUDIT" | "MODEL" | "ACTIVITY";
  category: "PRICE" | "FEATURE" | "ENTITLEMENT" | "LIFECYCLE" | "NOTE" | "GENERAL";
  actorLabel: string;
  actorUserId: string | null;
  beforeSummary: string | null;
  afterSummary: string | null;
  reason: string | null;
  relatedRecordId: string | null;
  relatedTab: string | null;
  success: boolean;
};

const FEATURE_ACTIONS = new Set([
  "PLAN_FEATURE_CREATED",
  "PLAN_FEATURE_UPDATED",
  "PLAN_FEATURE_VISIBILITY_CHANGED",
  "PLAN_FEATURE_HIGHLIGHT_CHANGED",
  "PLAN_FEATURE_REORDERED",
  "PLAN_FEATURE_DELETED",
]);

const PRICE_ACTIVITY_ACTIONS = new Set([
  "PLAN_PRICE_PUBLISHED",
  "PLAN_PRICE_CREATED",
]);

export function buildHistoryEventId(input: {
  eventType: string;
  planId: string;
  activityId?: string;
  priceId?: string;
  featureId?: string;
  versionId?: string;
  noteId?: string;
}): string {
  if (input.eventType === "PLAN_CREATED") return `plan-created:${input.planId}`;
  if (input.priceId && input.eventType === "PLAN_PRICE_PUBLISHED") {
    return `price-entity:${input.priceId}`;
  }
  if (input.activityId) return `plan-activity:${input.activityId}`;
  if (input.priceId) return `price:${input.priceId}:${input.eventType}`;
  if (input.featureId && input.activityId)
    return `feature:${input.featureId}:${input.eventType}:${input.activityId}`;
  if (input.versionId && input.eventType === "PLAN_ENTITLEMENT_PUBLISHED") {
    return `entitlement-entity:${input.versionId}`;
  }
  if (input.versionId) return `entitlement-version:${input.versionId}`;
  if (input.noteId) return `note:${input.noteId}:${input.eventType}`;
  return `plan-event:${input.planId}:${input.eventType}:${input.activityId ?? "model"}`;
}

export function historyDedupeKey(event: PlanHistoryEvent): string {
  if (
    event.relatedRecordId &&
    event.category === "PRICE" &&
    (event.eventType === "PLAN_PRICE_PUBLISHED" || event.eventType === "PLAN_PRICE_CREATED")
  ) {
    return `price-entity:${event.relatedRecordId}`;
  }
  if (
    event.relatedRecordId &&
    event.category === "ENTITLEMENT" &&
    event.eventType === "PLAN_ENTITLEMENT_PUBLISHED"
  ) {
    return `entitlement-entity:${event.relatedRecordId}`;
  }
  if (event.relatedRecordId && event.category === "NOTE") {
    return `note:${event.relatedRecordId}:${event.eventType}`;
  }
  if (event.relatedRecordId && event.category === "FEATURE") {
    return `feature-entity:${event.relatedRecordId}:${event.eventType}`;
  }
  return event.eventId;
}

export function dedupePlanHistoryEvents(events: PlanHistoryEvent[]): PlanHistoryEvent[] {
  const byId = new Map<string, PlanHistoryEvent>();
  const priority = { AUDIT: 3, ACTIVITY: 2, MODEL: 1 } as const;

  for (const event of events) {
    const key = historyDedupeKey(event);
    const existing = byId.get(key);
    if (!existing || priority[event.source] > priority[existing.source]) {
      byId.set(key, { ...event, eventId: key });
    }
  }

  return [...byId.values()].sort((a, b) => {
    const ta = new Date(a.occurredAt).getTime();
    const tb = new Date(b.occurredAt).getTime();
    if (tb !== ta) return tb - ta;
    return a.eventId.localeCompare(b.eventId);
  });
}

export function shouldSkipModelPriceEvent(activityActions: Set<string>, priceId: string): boolean {
  return activityActions.has(`PLAN_PRICE_PUBLISHED:${priceId}`);
}

export function parseActivityMessage(message: string | null): Record<string, unknown> {
  if (!message) return {};
  try {
    const parsed = JSON.parse(message);
    return typeof parsed === "object" && parsed ? (parsed as Record<string, unknown>) : {};
  } catch {
    return { text: message.slice(0, 500) };
  }
}

export function safeSummary(value: unknown, max = 200): string | null {
  if (value == null) return null;
  const s = typeof value === "string" ? value : JSON.stringify(value);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export function categorizeEventType(eventType: string): PlanHistoryEvent["category"] {
  if (eventType.includes("PRICE")) return "PRICE";
  if (FEATURE_ACTIONS.has(eventType)) return "FEATURE";
  if (eventType.includes("ENTITLEMENT")) return "ENTITLEMENT";
  if (eventType.includes("NOTE")) return "NOTE";
  if (eventType === "PLAN_CLONED") return "LIFECYCLE";
  if (eventType.includes("PLAN_")) return "LIFECYCLE";
  return "GENERAL";
}

export function isPriceActivityAction(action: string): boolean {
  return PRICE_ACTIVITY_ACTIONS.has(action);
}
