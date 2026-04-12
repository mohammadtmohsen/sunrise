# Lumora Test Matrix

## Alarm — Fullscreen (Locked Screen)

1. Create alarm (Fixed, Alarm style, Once) → lock screen → wait
   - [ ] Fullscreen AlarmActivity appears over lock screen
   - [ ] `alarm.mp3` plays and loops
   - [ ] Vibration works
   - [ ] Time display updates every second
   - [ ] Alarm name shows correctly
   - [ ] Dismiss button stops sound and closes
   - [ ] Snooze button stops sound, closes, fires again after snooze duration
   - [ ] Swipe up to dismiss works
   - [ ] After dismiss: alarm shows as **disabled** in the list (once mode)
   - [ ] After dismiss: phone returns to lock screen (not unlocked)

2. Create alarm (Fixed, Alarm style, Repeat Mon-Fri) → lock screen → wait
   - [ ] Same fullscreen behavior
   - [ ] After dismiss: alarm stays **enabled** and reschedules for next weekday

3. Create alarm (Relative, Before Sunrise, Alarm style) → lock screen → wait
   - [ ] Fires at correct offset from sunrise
   - [ ] Fullscreen works the same

---

## Alarm — Notification (Unlocked Screen)

4. Create alarm → stay on home screen (unlocked) → wait
   - [ ] Persistent heads-up notification appears with Dismiss/Snooze buttons
   - [ ] `reminder.mp3` plays (single, not looping)
   - [ ] Notification stays visible (doesn't auto-dismiss)
   - [ ] Notification also appears in notification shade
   - [ ] Tap Dismiss → sound stops, notification gone, alarm disabled (if once)
   - [ ] Tap Snooze → sound stops, notification gone, snooze fires later

5. Create alarm → stay inside the app scrolling → wait
   - [ ] Same notification behavior (no fullscreen takeover)
   - [ ] `reminder.mp3` plays
   - [ ] Dismiss from notification works

6. Swipe notification away (instead of tapping Dismiss)
   - [ ] Sound stops
   - [ ] Alarm disables (if once) on next app open
   - [ ] Next occurrence scheduled (if repeat)

---

## Reminder

7. Create reminder (Fixed, Reminder style, Once) → wait
   - [ ] Simple notification appears (not fullscreen, not ongoing)
   - [ ] `reminder.mp3` plays once
   - [ ] Short vibration
   - [ ] Notification has Dismiss button
   - [ ] Tap Dismiss → notification gone, alarm disabled (once)
   - [ ] Swipe away → same behavior

8. Create reminder (Repeat) → wait
   - [ ] After dismiss: stays enabled, reschedules for next occurrence

---

## Snooze

9. Alarm fires (locked) → tap Snooze
   - [ ] AlarmActivity closes, sound stops
   - [ ] Phone returns to lock screen
   - [ ] Alarm fires again after snooze duration (default 5 min)
   - [ ] Second fire is fullscreen with `alarm.mp3`

10. Alarm fires (unlocked) → tap Snooze on notification
    - [ ] Notification gone, sound stops
    - [ ] Fires again after snooze duration
    - [ ] Second fire is notification with `reminder.mp3`

---

## Sound

11. Default sounds
    - [ ] Fullscreen alarm plays `alarm.mp3` (looping)
    - [ ] Unlocked alarm notification plays `reminder.mp3` (single)
    - [ ] Reminder notification plays `reminder.mp3` (single)

12. Custom sound from settings
    - [ ] Set custom alarm sound in Settings → fullscreen alarm plays custom sound
    - [ ] Set custom reminder sound in Settings → reminders play custom sound
    - [ ] Clear custom sound → reverts to defaults

---

## Persistent Notification

13. Create an enabled alarm
    - [ ] Status bar shows persistent notification with next alarm time
    - [ ] Expanded view shows countdown + all upcoming alarms
    - [ ] Countdown updates (refreshes every 15 min via native, every 60s in foreground)

14. Disable all alarms
    - [ ] Persistent notification hides

15. Dismiss an alarm
    - [ ] Persistent notification updates to show the next alarm (not the dismissed one)

---

## Once vs Repeat

16. Once alarm fires → dismiss
    - [ ] Alarm shows disabled in the list
    - [ ] No future trigger scheduled

17. Repeat alarm (Mon-Fri) fires on Monday → dismiss
    - [ ] Alarm stays enabled
    - [ ] Next trigger shows Tuesday's time

18. Repeat alarm (every day) fires → dismiss
    - [ ] Next trigger shows tomorrow's time

---

## App Lifecycle

19. Create alarm → kill app (force stop) → wait for alarm
    - [ ] Alarm fires normally (native AlarmManager, no JS needed)
    - [ ] Fullscreen or notification depending on lock state

20. Create alarm → reboot device → wait for alarm
    - [ ] BootAlarmReceiver reschedules all alarms
    - [ ] Alarm fires at correct time

21. Dismiss alarm from notification (app NOT running) → open app
    - [ ] "Once" alarm shows as disabled
    - [ ] Persistent notification is updated
    - [ ] No phantom ringing

22. Open app after alarm fired and was dismissed
    - [ ] No sound plays
    - [ ] No fullscreen appears
    - [ ] App opens to home screen normally

---

## Permissions

23. Fresh install
    - [ ] Notification permission prompt appears (Android 13+)
    - [ ] After granting: Notifications shows "Granted" in settings
    - [ ] Battery optimization prompt appears on first launch

24. Exact Alarms permission
    - [ ] "Open settings" link works
    - [ ] After enabling: alarms schedule successfully

25. Full-Screen Alarm permission
    - [ ] "Enable (required)" link opens correct settings page

---

## Battery & Background

26. Enable battery saver → alarm fires
    - [ ] Alarm still fires on time (AlarmManager.setAlarmClock is exempt)

27. Enable battery optimization for Lumora → alarm fires
    - [ ] Warning shows in app
    - [ ] Alarm still fires (setAlarmClock is exempt from Doze)

---

## Timing Accuracy

28. Schedule alarm exactly 2 minutes from now
    - [ ] Fires within +/- 5 seconds of the target time

29. Schedule alarm for tomorrow 6:00 AM
    - [ ] Check AlarmManager dump: correct trigger time in local timezone

30. Relative alarm: 30 min before sunrise
    - [ ] Correct trigger time = sunrise - 30 min
    - [ ] Recalculates if location changes

---

## Edge Cases

31. Create alarm for a time that just passed (e.g., current time)
    - [ ] Schedules for tomorrow (not immediate fire)

32. Create two alarms at the same time
    - [ ] Both register in AlarmManager
    - [ ] First one fires, then second fires

33. Delete an alarm that's about to fire
    - [ ] Alarm does NOT fire
    - [ ] No leftover notification

34. Toggle alarm off then on rapidly
    - [ ] Final state is correct (enabled/disabled matches toggle)
    - [ ] No duplicate alarms in AlarmManager

---

## Reminder Lock Screen Behavior

> **KNOWN ISSUE — TODO**: Reminder notifications do not turn the screen on when the
> phone is locked. On Android 15, any wake lock with ACQUIRE_CAUSES_WAKEUP unlocks
> the device entirely. HIGH importance notifications should light up the screen via
> the system "wake screen for notifications" setting, but this may not work on
> emulators or all devices. Needs investigation — possible solutions:
> - Test on a real device (emulator may not support notification screen wake)
> - Use a native AccessibilityService to simulate power button
> - Use NotificationManager.Policy to force screen wake
> - Investigate Android 15 specific APIs for waking screen without unlocking

---

## Lock Screen Behavior

> **KNOWN ISSUE — TODO**: After dismiss/snooze from fullscreen alarm on locked screen,
> the phone stays unlocked instead of returning to the lock screen.
> Investigated: removed `turnScreenOn`, `requestDismissKeyguard`, `FULL_WAKE_LOCK`,
> `singleInstance`, tried `moveTaskToBack`, `setShowWhenLocked(false)`,
> `screenBrightness=0`, `FLAG_ALLOW_LOCK_WHILE_SCREEN_ON`.
> Android 15 (API 35) transitions keyguard to GONE state when the alarm activity appears.
> Needs deeper investigation — possibly emulator-specific or requires a different
> screen wake strategy (e.g., only waking via notification fullScreenIntent without
> any activity-level screen wake flags). Revisit and test on a real device.

35. Alarm fires on locked screen → Dismiss
    - [ ] Phone returns to lock screen (not unlocked)

36. Alarm fires on locked screen → Snooze
    - [ ] Phone returns to lock screen (not unlocked)

37. Alarm fires on locked screen → Swipe up to dismiss
    - [ ] Phone returns to lock screen (not unlocked)

38. Alarm fires on locked screen → Back button
    - [ ] Same as dismiss — phone returns to lock screen
