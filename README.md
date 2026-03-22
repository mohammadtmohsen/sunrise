# Sunrise 🌅

A React Native Expo app that calculates daily sunrise and sunset times based on your location and lets you set alarms relative to them — or at fixed times. Designed to simulate the native alarm experience on Android (full-screen intent over lock screen) with the best possible equivalent on iOS (Critical Alerts).

## Features

### Core
- **Automatic sunrise/sunset calculation** — Uses GPS location with the [suncalc](https://github.com/mourner/suncalc) library. Fully offline, no API keys needed.
- **Relative alarms** — Set alarms like "30 minutes before sunrise" or "1 hour after sunset". The trigger time automatically adjusts daily as sunrise/sunset times shift throughout the year.
- **Absolute alarms** — Set fixed-time daily alarms (e.g., 6:30 AM) that don't depend on sun position.
- **Multiple named alarms** — Create as many alarms as you need, each with a custom name.

### Alarm Experience
- **Android full-screen intent** — When the alarm fires, a full-screen alarm UI appears over the lock screen (like the native Clock app), even when the device is off or locked.
- **Swipe to dismiss** — Swipe up gesture to dismiss the alarm, or tap the Dismiss/Snooze buttons.
- **Snooze** — Configurable snooze duration (default 5 minutes).
- **Persistent sound** — Alarm sound plays via Android foreground service until dismissed. On iOS, plays even in silent mode.
- **Notification quick actions** — Dismiss and Snooze buttons directly on the notification (both platforms).
- **Vibration pattern** — Haptic feedback accompanies the alarm sound.

### Reliability
- **Triple-redundancy recalculation:**
  1. **Background fetch** — Recalculates alarm times every ~6 hours even when the app is killed.
  2. **Foreground recalc** — Recalculates when the app comes to the foreground on a new day.
  3. **Next-day-on-dismiss** — When you dismiss an alarm, tomorrow's occurrence is immediately scheduled.
- **Reboot survival** — Alarms persist across device reboots (Notifee's RebootBroadcastReceiver on Android, native on iOS).
- **Battery optimization handling** — Detects Android OEM battery restrictions (Samsung, Xiaomi, Huawei, etc.) and prompts the user to disable them.

### iOS Specific
- **Critical Alerts** — Bypasses Do Not Disturb and Focus modes (requires Apple entitlement).
- **Time Sensitive notifications** — Falls back gracefully if Critical Alerts aren't available.
- **Custom .caf sound** — Bundled alarm sound in iOS-native format.

### UI/UX
- **Dark theme** throughout with sunrise/sunset color accents.
- **Daylight progress bar** — Visual indicator showing current position between sunrise and sunset.
- **Animated alarm trigger screen** — Pulsing icon, glow effect, bouncing swipe hint, subtle background color transitions.
- **Swipe-to-delete** alarm cards on the home screen.
- **Haptic feedback** on all interactive elements.
- **Full accessibility** — VoiceOver/TalkBack labels, roles, hints, and adjustable controls on all screens.

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | Expo SDK 55 + `expo-dev-client` | Native modules required (Notifee, MMKV). Dev builds via EAS or `npx expo run:*` |
| Navigation | Expo Router v4 | File-based routing with deep link support for alarm intents |
| Sun Calculation | suncalc | Offline, no API dependency, ~4KB, accurate within 1-2 minutes |
| Location | expo-location | Foreground-only GPS — one fetch per day is sufficient |
| Alarm Scheduling | @notifee/react-native | AlarmManager integration, full-screen intents, foreground service, reboot survival, OEM battery helpers |
| Background Tasks | expo-task-manager + expo-background-fetch | Daily recalculation of alarm times |
| State Management | Zustand + react-native-mmkv | MMKV is synchronous (critical for background tasks and boot receivers), 30x faster than AsyncStorage |
| UI Styling | Inline styles (StyleSheet) | Direct React Native styling, dark theme color system |
| Animations | react-native-reanimated + react-native-gesture-handler | Swipe-to-dismiss gesture, daylight bar animation, alarm trigger effects |
| Sound | expo-av | Alarm sound playback with silent mode bypass on iOS |
| Date Math | dayjs | Lightweight offset calculations |

## Project Structure

```
sunrise/
├── app/                              # Expo Router screens
│   ├── _layout.tsx                   # Root layout, notification handlers, init
│   ├── index.tsx                     # Home: sun times + alarm list
│   ├── alarm/create.tsx              # Create alarm (relative or absolute)
│   ├── alarm/[id].tsx                # Edit/delete alarm
│   ├── alarm-trigger.tsx             # Full-screen alarm dismiss screen
│   └── settings.tsx                  # Location, permissions, defaults
│
├── plugins/
│   ├── withAlarmPermissions.js       # Android: USE_FULL_SCREEN_INTENT, foreground service, boot receiver
│   └── withIOSAlarmPermissions.js    # iOS: Critical Alerts entitlement, background modes
│
├── src/
│   ├── components/
│   │   ├── AbsoluteTimePicker.tsx    # 12-hour time roller with AM/PM toggle
│   │   ├── AlarmCard.tsx             # Alarm list item with swipe-to-delete
│   │   ├── AlarmScreenComponent.tsx  # Standalone RN root for Android full-screen intent
│   │   ├── BatteryOptimizationPrompt.tsx
│   │   ├── PermissionBanner.tsx
│   │   ├── SunTimesDisplay.tsx       # Sunrise/sunset card with daylight progress bar
│   │   └── TimeOffsetPicker.tsx      # Hours:Minutes stepper for relative offsets
│   │
│   ├── hooks/
│   │   ├── useAlarms.ts             # Alarm CRUD + scheduling bridge
│   │   ├── useAppStateRecalculation.ts  # Foreground recalc on day change
│   │   ├── useLocation.ts           # GPS fetch + caching
│   │   └── useSunTimes.ts           # Memoized suncalc wrapper
│   │
│   ├── stores/
│   │   ├── alarmStore.ts            # Zustand + MMKV — alarm CRUD, recalculation
│   │   ├── locationStore.ts         # GPS coordinates cache
│   │   ├── settingsStore.ts         # App preferences
│   │   └── storage.ts               # MMKV ↔ Zustand adapter
│   │
│   ├── services/
│   │   ├── alarmScheduler.ts        # Core: schedule/cancel via Notifee, handles both alarm types
│   │   ├── nextDayScheduler.ts      # Schedule next occurrence on dismiss
│   │   ├── notificationService.ts   # Channels, permissions, iOS categories
│   │   ├── soundService.ts          # expo-av playback with silent mode bypass
│   │   └── sunCalcService.ts        # suncalc wrapper
│   │
│   ├── tasks/
│   │   └── backgroundRecalculate.ts # Background fetch task (~6h interval)
│   │
│   ├── models/types.ts              # TypeScript interfaces
│   └── utils/
│       ├── constants.ts             # Colors, defaults
│       └── timeUtils.ts             # Format, compute triggers (relative + absolute)
│
├── assets/sounds/                    # Alarm sounds (.wav, .caf, .mp3)
├── index.ts                          # Entry: registers Notifee handlers + AlarmScreen before app
├── app.json                          # Expo config with plugins
└── package.json
```

## Getting Started

### Prerequisites
- Node.js >= 20.19.4
- Expo CLI (`npx expo`)
- For iOS: Xcode + CocoaPods
- For Android: Android Studio + Android SDK

> **Note:** This app requires development builds (`expo-dev-client`). It will **not** work with Expo Go because of native module dependencies (Notifee, MMKV).

### Installation

```bash
# Clone the repository
git clone https://github.com/mohammadtmohsen/sunrise.git
cd sunrise

# Install dependencies
npm install

# For iOS
npx expo run:ios

# For Android
npx expo run:android
```

### EAS Build (recommended for device testing)

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure (first time)
eas build:configure

# Build for development
eas build --platform ios --profile development
eas build --platform android --profile development
```

## How It Works

### Alarm Scheduling Pipeline

```
User creates alarm
       ↓
alarmStore.addAlarm() → persists to MMKV
       ↓
alarmScheduler.scheduleAlarm()
       ↓
   ┌───────────────────────────────────┐
   │ Alarm type?                       │
   ├─── relative ──→ sunTimes[event]   │
   │                 + offsetMinutes   │
   ├─── absolute ──→ next occurrence   │
   │                 of HH:MM today    │
   │                 or tomorrow       │
   └───────────────────────────────────┘
       ↓
notifee.createTriggerNotification()
  • AlarmManager.setAlarmClock() (Android)
  • fullScreenAction.mainComponent: 'alarm-screen'
  • asForegroundService: true
  • Critical Alerts + timeSensitive (iOS)
       ↓
   ┌────────────────────────────┐
   │ Alarm fires                │
   ├─── Screen off/locked ────→ │ Full-screen AlarmScreenComponent
   ├─── App in foreground ────→ │ Navigate to /alarm-trigger
   ├─── App killed ───────────→ │ Notification + quick actions
   └────────────────────────────┘
       ↓
User dismisses or snoozes
       ↓
scheduleNextDayAlarm() → tomorrow's occurrence
```

### Android Permissions (via config plugin)

| Permission | Purpose |
|---|---|
| `USE_FULL_SCREEN_INTENT` | Show alarm UI over lock screen |
| `SCHEDULE_EXACT_ALARM` | Exact alarm timing (via Notifee) |
| `FOREGROUND_SERVICE` | Persistent alarm sound playback |
| `FOREGROUND_SERVICE_MEDIA_PLAYBACK` | Android 14+ service type |
| `RECEIVE_BOOT_COMPLETED` | Reschedule alarms after reboot |
| `WAKE_LOCK` | Keep screen on during alarm |
| `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` | Prompt for battery exemption |

### iOS Entitlements (via config plugin)

| Entitlement | Purpose |
|---|---|
| `com.apple.developer.usernotifications.critical-alerts` | Bypass DnD/Focus modes |
| `UIBackgroundModes: audio, fetch` | Background sound + recalculation |

> **Critical Alerts** require Apple approval. Submit a request at: https://developer.apple.com/contact/request/notifications-critical-alerts-entitlement/

## Data Model

```typescript
interface Alarm {
  id: string;
  name: string;
  type: 'relative' | 'absolute';

  // Relative: "30 min before sunrise"
  referenceEvent: 'sunrise' | 'sunset';
  offsetMinutes: number;   // negative = before, positive = after

  // Absolute: "6:30 AM daily"
  absoluteHour: number;    // 0-23
  absoluteMinute: number;  // 0-59

  isEnabled: boolean;
  snoozeDurationMinutes: number;
  nextTriggerAt: string | null;  // ISO 8601, recalculated daily
  notificationId: string | null;
}
```

## Screenshots

*Coming soon — the app requires a development build on a physical device.*

## Roadmap

- [ ] Repeat days selection (e.g., weekdays only) for absolute alarms
- [ ] Multiple alarm sound choices
- [ ] Sunrise/sunset visual animation on alarm trigger screen
- [ ] Live Activity on iOS (Dynamic Island + lock screen)
- [ ] Widget showing next alarm time
- [ ] Manual location entry for users who deny GPS
- [ ] E2E tests with Maestro

## License

MIT
