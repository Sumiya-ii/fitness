# Coach -- Product Audit for Marketing

> Last updated: 2026-04-08
> Source: Codebase analysis of `apps/mobile/src/` and `apps/api/src/`

---

## 1. Feature Inventory

### Core Features (from codebase)

| Feature | Status | Description | Marketing Value |
|---------|--------|-------------|-----------------|
| AI Photo Food Recognition | Live | Snap a photo of any food (inc. Mongolian dishes: buuz, khuushuur, tsuivan) and get instant calorie + macro breakdown. Uses GPT-4o with Gemini fallback. Returns: meal name, per-item calories/protein/carbs/fat/fiber/sugar/sodium/saturated fat, serving grams, confidence score. | **KEY DIFFERENTIATOR** -- "Зураг авч калори тоол" is the hero feature |
| Voice Food Logging (STT) | Live | Mongolian speech-to-text via OpenAI Whisper (gpt-4o-transcribe). Say what you ate in Mongolian. | Hands-free convenience, Mongolian-first |
| Text Search Food Logging | Live | Search food database by name | Standard, expected feature |
| Barcode Scanning | Live | Scan product barcodes, submit for lookup | Useful for packaged foods |
| Quick Add | Live | Manually enter calories/macros | Power user feature |
| Favorites & Recents | Live | Save and reuse frequently logged foods | Retention feature -- reduces friction |
| Meal Templates | Live | Save entire meals as templates, reuse with one tap | Time-saving, retention |
| Water Logging | Live | Track daily water intake with targets | Engagement driver |
| Macro/Calorie Dashboard | Live | Ring visualization showing daily progress for calories, protein, carbs, fat | Visually satisfying -- screenshottable |
| Weight Logging + Progress Charts | Live | Track weight over time with visual charts | Transformation tracking |
| Body Composition Logging | Live | Track body measurements beyond weight | Advanced fitness tracking |
| Workout Logging | Live | Custom exercises, active workout timer, history, detail view. MET-based calorie calculation. | Full fitness tracking, not just nutrition |
| AI Coach Chat | Live | Personalized AI coach with memory. Sends proactive messages: morning greeting, water reminders, meal nudges, midday check-in, progress feedback, weekly summary, streak celebration. Cooldown system prevents spam. Max 4 messages/day. Quiet hours respected. | Engagement + retention machine |
| Adaptive Calorie Targets | Live | Auto-adjusts calorie targets based on actual progress | Smart, personalized -- differentiator |
| Weekly Summary Reports | Live | AI-generated weekly progress reports via push + Telegram | Retention + shareable content |
| Streaks | Live | Track meal logging and water goal streaks | Gamification, retention |
| Telegram Bot Integration | Live | Receive coach messages and summaries via Telegram | Mongolia-relevant (Telegram popular) |
| Push Notifications | Live | Expo push notifications for reminders | Standard engagement |
| QPay Payments | Live | Monthly (19,900 MNT) and Yearly (149,900 MNT) plans via QPay QR code | Mongolia-native payment |
| RevenueCat / Apple IAP | Live | Apple App Store subscription support | For international users |
| Full Onboarding | Live | 16-screen flow: theme, goal, desired weight, weekly rate, gender, birthdate, height, weight, activity level, diet preference, motivation, target review, subscription pitch, notification permission | Personalized from first touch |
| Dark/Light Theme | Live | User-selectable theme | Modern UX |
| i18n (Mongolian + English) | Live | Full localization | Mongolian-first |
| GDPR Privacy | Live | Data export + account deletion | Trust signal |
| Reminders | Live | Customizable reminder settings with quiet hours | User control |

### Premium (Pro) vs Free

- **Free tier**: Core logging features (limited)
- **Pro tier**: Full AI features, unlimited photo recognition, voice logging, AI coach, advanced analytics
- **Pricing**: 19,900 MNT/month (~$5.80) or 149,900 MNT/year (~$43.70, ~37% savings)

---

## 2. User Journey Map

```
Discovery (Social/Ad) --> App Store --> Download --> Onboarding (16 screens)
    |                                                       |
    v                                                       v
Theme Select --> Goal (lose/gain/maintain) --> Body stats --> Activity level
    |                                                       |
    v                                                       v
Diet preference --> Target review --> Sign up --> Subscription pitch
    |                                                       |
    v                                                       v
Home Dashboard (rings) <--> Log Screen (photo/voice/text/barcode/quick/template)
    |                           |
    v                           v
Progress (charts/weight) <--> Coach Chat (AI conversations)
    |                           |
    v                           v
Weekly Summary <--> Settings (profile/reminders/telegram/subscription)
    |
    v
Workout (type picker --> active timer --> history --> detail)
```

### Key Moments of Delight

1. **First photo scan** -- user snaps buuz, sees instant calorie breakdown
2. **Ring completion** -- hitting daily calorie/macro targets
3. **Streak milestone** -- 3+ day streak celebration from AI coach
4. **Weekly summary** -- AI-generated progress report
5. **Voice logging** -- speaking in Mongolian and seeing it understood
6. **Template reuse** -- one-tap logging of saved meals

---

## 3. Value Proposition

### Primary
"Монголын анхны AI хоолны дасгалжуулагч -- зураг авч калори тоол"
(Mongolia's first AI nutrition coach -- snap a photo to count calories)

### Supporting Props
- Mongolian food database built-in (buuz, khuushuur, tsuivan, banshtai shol, etc.)
- Voice logging in Mongolian language
- Personalized AI coach that knows your goals
- QPay payment -- no international card needed
- Complete fitness tracking (nutrition + workouts + body composition)

### Competitive Moat
- Only nutrition app with Mongolian food recognition
- Only app with Mongolian voice-to-food-log
- QPay integration (competitors require international payment)
- Mongolian-first UI and coach personality
- AI coach with memory (remembers user preferences and patterns)

---

## 4. Audience Segments

### Segment 1: "Fitness Эхлэгч" (Fitness Beginner)
- **Age**: 18-25
- **Profile**: University students, young professionals starting fitness journey
- **Pain**: Don't know calories in Mongolian food, overwhelmed by fitness info
- **Hook**: "Буузанд хэдэн калори байдгийг мэдэх үү?" (Do you know how many calories are in buuz?)
- **Feature focus**: Photo recognition, basic calorie tracking

### Segment 2: "Идэвхтэй Gym-чин" (Active Gym-Goer)
- **Age**: 22-35
- **Profile**: Regular gym-goers, follows fitness influencers
- **Pain**: Can't accurately track Mongolian food macros, manually counting is tedious
- **Hook**: "Фото авч макро тоол -- гар утасгүй тооцоо хийх хэрэггүй" (Photo macro counting -- no manual calculation needed)
- **Feature focus**: Photo + voice logging, workout tracking, macro dashboard

### Segment 3: "Жин хасагч" (Weight Loss Seeker)
- **Age**: 25-45
- **Profile**: Wants to lose weight, tried various diets
- **Pain**: Doesn't know portion sizes, can't stick to diet, no accountability
- **Hook**: "AI дасгалжуулагч чамд зөвлөнө, санана, урамшуулна" (AI coach advises, reminds, motivates you)
- **Feature focus**: Calorie tracking, AI coach, weekly summaries, adaptive targets

### Segment 4: "Эрүүл амьдрал" (Health-Conscious)
- **Age**: 30-50
- **Profile**: Health-conscious parents, professionals
- **Pain**: Wants to eat healthier but doesn't know nutrition content of Mongolian food
- **Hook**: "Монгол хоолны шим тэжээлийг мэдэж ид" (Know the nutrition of Mongolian food before you eat)
- **Feature focus**: Nutrition tracking, water reminders, body composition

---

## 5. Content-Worthy Moments (Screenshot/Video Gold)

### High-Impact Visual Moments

1. **Photo Scan Reveal** -- The moment when AI processes food photo and numbers appear
   - Buuz plate scan -> "6 ширхэг бууз = 456 ккал"
   - Khuushuur scan -> calorie reveal
   - Restaurant meal scan -> full breakdown

2. **Ring Completion** -- Daily macro rings closing (like Apple Watch)
   - Satisfying visual animation
   - "Өнөөдрийн зорилгоо биелүүлсэн!" moment

3. **Calorie Comparison Side-by-Side**
   - Буузтай шөл vs хуушуур: which has more calories?
   - Mongolian food calorie comparison charts

4. **Voice Logging Demo** -- Speaking "Өглөөний цай 2 шил сүүтэй" and seeing it logged
   - Wow factor for Mongolian users

5. **Weekly Summary Card** -- AI-generated progress summary
   - Shareable format, personal achievement

6. **Streak Milestones** -- 7 day, 30 day, 100 day streak visuals

7. **Before/After Dashboard** -- Week 1 vs Week 12 progress comparison

8. **Onboarding Personalization** -- The "your daily target is X calories" reveal moment

---

## 6. Safe Marketing Claims

### Can Say (backed by product)
- "AI хоолны зураг таних технологи" (AI food photo recognition technology)
- "Монгол хоолыг таньдаг" (Recognizes Mongolian food)
- "Зургаар калори тоол" (Count calories by photo)
- "Монгол хэлээр дуугаар хоол бүртгэ" (Log food by voice in Mongolian)
- "Хувийн AI дасгалжуулагч" (Personal AI coach)
- "QPay-ээр төл" (Pay with QPay)
- "Өдөр бүр урам зориг өгнө" (Daily motivation)
- "Монголын анхны AI тэжээлийн апп" (Mongolia's first AI nutrition app)

### Cannot Say / Must Avoid
- "Жин хасна гэж баталгаатай" (Guaranteed weight loss) -- medical claim
- Specific weight loss promises ("2 долоо хоногт 5кг хас")
- "Эмчийн зөвлөгөөг орлоно" (Replaces doctor's advice) -- medical disclaimer needed
- "100% нарийвчлалтай" (100% accurate) -- AI estimates have variance
- Comparing to competitors by name in ads (risky, unnecessary)

### Recommended Disclaimers
- "AI-н тооцоо нь ойролцоо утга юм" (AI calculations are approximate values)
- "Эмчийн зөвлөгөөг орлохгүй" (Does not replace medical advice)
- Results shown are illustrative / individual results may vary

---

## 7. Pricing Strategy for Marketing

| Plan | Price | Marketing Angle |
|------|-------|----------------|
| Free | 0 MNT | "Туршиж үзээрэй" (Try it out) -- limited daily photo scans |
| Monthly Pro | 19,900 MNT | "Өдөрт ~660 MNT" (Less than a cup of coffee per day) |
| Yearly Pro | 149,900 MNT | "Сард ~12,500 MNT -- 37% хэмнэ" (Save 37% vs monthly) |

QPay-specific marketing: Show QR scan flow in content. Emphasize "Монгол банкны апп-аар шууд төл" (Pay directly with your Mongolian bank app).

---

## 8. Technical Differentiators Worth Marketing

1. **Dual AI Vision**: Uses Gemini 2.0 Flash as primary, GPT-4o as fallback -- ensures photo recognition always works
2. **Mongolian Food Knowledge**: System prompt explicitly trained on Mongolian cuisine (buuz, khuushuur, tsuivan, banshtai shol, tavgtai khool, tarag, aaruul)
3. **8 Nutrition Metrics**: Not just calories -- protein, carbs, fat, fiber, sugar, sodium, saturated fat per food item
4. **Confidence Scoring**: Each food item gets a confidence score (0.9+ = clearly visible, 0.6-0.89 = reasonable estimate)
5. **Smart Coach Timing**: AI coach respects quiet hours, has cooldowns, daily message caps -- not spammy
6. **Adaptive Targets**: Calorie goals auto-adjust based on actual progress -- gets smarter over time
7. **Coach Memory**: AI remembers past conversations and user preferences across sessions

---

## 9. App Store Optimization (ASO) Keywords

### Mongolian Keywords (Primary)
- калори тоологч (calorie counter)
- хоолны апп (food app)
- фитнесс апп (fitness app)
- жин хасах (weight loss)
- хоолны зураг (food photo)
- AI дасгалжуулагч (AI coach)
- шим тэжээл (nutrition)
- бие тамир (fitness/exercise)
- эрүүл хоол (healthy food)
- макро тоологч (macro counter)

### English Keywords (Secondary)
- calorie counter Mongolia
- food photo calorie
- AI nutrition coach
- Mongolian food calories
- fitness tracker Mongolia
