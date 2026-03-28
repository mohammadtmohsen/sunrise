# Lumora - Sunrise/Sunset Alarm App

## Build Commands

```bash
# Preview build (standalone APK, no dev server needed) - use for testing alarms
eas build --profile preview --platform android

# Development build (requires dev server connection)
eas build --profile development --platform android

# Start dev server (for development builds only)
npx expo start --dev-client
```

## Project Overview

Expo React Native alarm app that schedules alarms relative to sunrise/sunset or at fixed times. Uses `@notifee/react-native` for notifications, foreground services, and alarm scheduling.

## Key Architecture

- **Alarm scheduling**: `src/services/alarmScheduler.ts` — uses Notifee `createTriggerNotification` with `AlarmType.SET_ALARM_CLOCK`
- **Foreground service**: `index.ts` — plays alarm sound and launches app via `Linking.openURL` (bypasses MIUI full-screen intent block)
- **Alarm trigger screen**: `app/alarm-trigger.tsx` — full-screen alarm UI, cancels notification badge on open, exits app on dismiss
- **Background recalculation**: `src/tasks/backgroundRecalculate.ts` — recalculates sun-relative alarms every ~6 hours
- **State**: Zustand + MMKV for persistent alarm storage

## Xiaomi/Redmi (MIUI) Notes

Standard Android `fullScreenIntent` does NOT work on MIUI. The app uses `Linking.openURL('lumora://alarm-trigger')` from the foreground service to launch the app directly.

Required MIUI permissions for alarms to work:
1. Settings > Apps > Manage apps > Lumora > **Autostart** — enable
2. Settings > Apps > Manage apps > Lumora > **Other permissions** > "Display pop-up windows while running in the background" — enable
3. Settings > Battery > Lumora — set to **"No restrictions"**

## EAS Build Limits

Free plan has monthly Android build limits. Resets on the 1st of each month. Check status at: https://expo.dev/accounts/mohammadtmohsen/settings/billing
