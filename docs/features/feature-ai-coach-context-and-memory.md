# AI Coach — Context, Memory & Data Architecture

Status: **Draft — awaiting feedback**
Last updated: 2026-03-19

---

## Vision

The AI coach should feel like a personal trainer and nutritionist who knows you deeply — your goals, your eating habits, how you've been doing this week, what foods you like, and how to motivate you. It should be able to answer questions like:

- "What did I eat today?"
- "Am I on track for my protein goal this week?"
- "What should I have for dinner given what I've eaten?"
- "How have I been doing this month?"
- "Remember, I don't like fish."

This document captures the architecture decisions needed to make that possible.

---

## Current State (What Exists Today)

The coach currently receives only **today's nutrition summary** injected into the system prompt:

```
Today's nutrition status:
- Calories: 1200 / 2000 kcal (800 remaining)
- Protein: 80g / 150g
- Carbs: 120g / 200g
- Fat: 40g / 65g
- Meals logged: 2
```

**What's missing:**
- Actual meal names and food items (what was eaten, not just totals)
- Historical context (yesterday, this week, trends)
- User profile (goals, preferences, dietary restrictions)
- Exercise / workout data
- Long-term memory (things the user tells the coach explicitly)
- Body metrics (weight trend)

---

## Context Layers

The system prompt should be built from multiple context layers, each serving a different purpose:

### Layer 1 — Identity & Goals (static, loaded once)
Who the user is and what they're trying to achieve.

```
User profile:
- Name: [name]
- Age: [age], Gender: [gender]
- Height: [height], Current weight: [weight]
- Goal: [lose weight / build muscle / maintain]
- Target weight: [x kg] by [date]
- Activity level: [sedentary / moderate / active]
- Dietary preferences: [vegetarian / no restrictions / etc.]
- Calorie target: [x] kcal/day
- Macro targets: [x]g protein, [x]g carbs, [x]g fat
```

**Data source:** `Profile`, `Target`, `WeightLog` (latest entry) in Prisma.

---

### Layer 2 — Today's Detail (dynamic, per-message)
Not just totals — actual foods eaten.

```
Today (March 19):
Breakfast (08:30): Tsuivan — 450 kcal, 22g protein
Lunch (13:00): Buuz x3 — 380 kcal, 18g protein
Snack (15:30): Apple — 80 kcal, 0g protein

Totals: 910 / 2000 kcal consumed, 40g / 150g protein
Remaining: 1090 kcal, 110g protein
```

**Data source:** `MealLog` + `MealLogItem` joined with food names — already available in `DashboardService`, just needs meal-level detail added.

---

### Layer 3 — Recent History (dynamic, per-message)
Last 7 days at a summary level.

```
Past 7 days:
- Mon: 1850 kcal ✓  Tue: 2200 kcal (over)  Wed: 1400 kcal
- Thu: 1900 kcal ✓  Fri: 1600 kcal           Sat: 2100 kcal
- 7-day avg: 1864 kcal/day | Protein avg: 98g/day
- Streak: logged 5 of 7 days
```

**Data source:** `MealLog` aggregated over last 7 days.

---

### Layer 4 — Body Metrics (dynamic)
Weight trend so the coach can track progress.

```
Weight log:
- Current: 78.5 kg (logged 2 days ago)
- 30-day change: -1.2 kg
- Trend: losing ~0.3 kg/week (on track for goal)
```

**Data source:** `WeightLog`.

---

### Layer 5 — Workout Data (dynamic, if logged)
Exercise context so the coach can adjust nutrition advice.

```
Today's activity:
- Morning run: 5 km, ~300 kcal burned
- Strength training: 45 min

This week: 3 workouts logged
```

**Data source:** `WorkoutLog` (model exists in schema, implementation TBD).

---

### Layer 6 — Long-Term Memory (persistent, user-editable)
Things the user explicitly tells the coach that should be remembered forever.

```
Things I know about you:
- You dislike fish and seafood
- You're lactose intolerant
- You prefer to eat 4 smaller meals rather than 3 large ones
- You work night shifts (Mon–Thu), so dinner is at midnight
- You find it hard to hit protein after 6pm
```

**This is the most complex layer** — see design questions below.

---

## Long-Term Memory Design Options

This is the key architectural decision. Three approaches:

### Option A — Redis key-value (simplest)
Store a text blob in Redis keyed by userId. The coach can read it every message. The user or the coach can append to it.

- **Pros:** Simple, already have Redis, fast reads
- **Cons:** No structure, can grow unbounded, hard to edit specific facts
- **Best for:** Starting simple, iterating later

### Option B — Prisma table (`UserMemory`)
A structured table with individual memory entries:

```
model UserMemory {
  id        String   @id @default(cuid())
  userId    String
  category  String   // "preference", "restriction", "schedule", "goal"
  content   String   // "dislikes fish"
  source    String   // "user_told_coach", "inferred", "onboarding"
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
}
```

- **Pros:** Queryable, can show user their memories in settings, can delete individual facts
- **Cons:** More complex, need migration
- **Best for:** Production-quality memory with UI for managing it

### Option C — Vector database (most powerful)
Embed each memory as a vector. Retrieve the top-N most relevant memories per message using semantic search.

- **Pros:** Scales to hundreds of memories, retrieves only what's relevant
- **Cons:** Needs Pinecone/Weaviate or pgvector, significantly more complex
- **Best for:** Later stage when users have rich history

**Recommended path:** Start with Option A (Redis blob), migrate to Option B once the UX for viewing/editing memories is needed.

---

## How the Coach Saves Memories

When the user says something memorable ("I don't like fish", "I work night shifts"), the coach should detect it and save it. Two approaches:

### Approach 1 — Explicit extraction pass
After every assistant response, run a second GPT call to extract any new facts worth remembering. Cheaper model (gpt-4o-mini), low latency since it runs async after the reply is sent.

### Approach 2 — Tool calling
Give GPT a `save_memory` tool it can call whenever it decides something is worth remembering. More reliable, no second LLM call.

**Recommended:** Tool calling (Approach 2) — clean, reliable, no extra latency.

---

## System Prompt Assembly (Proposed)

```typescript
async buildSystemPrompt(userId: string): Promise<string> {
  const [profile, todayDetail, weekSummary, weightTrend, memory] = await Promise.all([
    this.getUserProfile(userId),
    this.getTodayMealDetail(userId),
    this.getWeekSummary(userId),
    this.getWeightTrend(userId),
    this.getLongTermMemory(userId),
  ]);

  return [
    COACH_PERSONA,
    profile,
    todayDetail,
    weekSummary,
    weightTrend,
    memory,
  ].filter(Boolean).join('\n\n');
}
```

All context fetched in parallel, assembled into a single system prompt.

---

## Workout Data Gap

The `WorkoutLog` model exists in the Prisma schema but there's no logging UI in the app yet.

**Questions for you:**
- Is workout tracking a priority feature? Or is this purely a nutrition coach for now?
- Would you want the coach to adjust calorie recommendations based on logged workouts?
- Do you want to integrate Apple Health / HealthKit for automatic workout import?

---

## Open Questions For You

I've designed the layers above based on what makes sense architecturally, but I need your input on several key decisions:

**1. Memory scope**
When the coach remembers something, should it be permanent until the user deletes it? Or should memories expire (e.g., "I'm on a trip this week" should auto-expire)?

**2. Coach proactivity**
Should the coach ever message you first — e.g., a daily check-in at a set time ("How's your day going? You haven't logged lunch yet"), or only respond when you message it?

**3. Workout tracking**
Is exercise data in scope now, or do you want to focus purely on nutrition coaching first?

**4. Memory visibility**
Should users be able to see and delete what the coach has remembered about them (e.g., in Settings)? This affects whether we use Redis (invisible) or a DB table (manageable).

**5. Historical depth**
How far back should the coach's context go? 7 days? 30 days? The longer the window, the more tokens we use per message (cost increases).

**6. Calorie adjustment for exercise**
If the user logs a 500 kcal workout, should the coach automatically adjust the remaining calories shown? (Some coaches do "net calories", others track separately.)

**7. Multiple users**
Right now it's just you testing. When multiple users use the app, each gets their own isolated context and memory. Is there any social/sharing angle (e.g., see a friend's progress) or is this strictly personal?

**8. Tone and language**
The current system prompt supports Mongolian and English. Should the coach default to one language and switch only when the user writes in the other? Or always match what the user writes?

---

## Proposed Implementation Phases

### Phase 1 — Rich Today Context (quick win, ~2 hours)
- Add actual food names to today's context (not just totals)
- Add meal timestamps and types
- No schema changes needed — just improve the DashboardService query

### Phase 2 — Historical Summary (1 day)
- Add 7-day calorie/protein summary to system prompt
- Add weight trend
- No schema changes needed

### Phase 3 — Long-Term Memory via Redis (1 day)
- Redis blob for user memories
- GPT tool calling to save memories
- No schema changes needed

### Phase 4 — Structured Memory with UI (2–3 days)
- `UserMemory` Prisma model + migration
- Settings screen to view/delete memories
- Migrate from Redis blob to DB

### Phase 5 — Workout Integration (1 week)
- Workout logging UI
- Apple Health / HealthKit integration
- Exercise context in system prompt

---

## Next Step

Read this document, answer the open questions above (or as many as you want), and tell me which phase to start with. The Phase 1 change (actual food names in context) can be done today with zero schema changes and will immediately fix the "What did I eat today?" problem.
