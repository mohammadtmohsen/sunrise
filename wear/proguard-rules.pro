# Keep Gson serialization models
-keep class com.lumora.wear.data.** { *; }
-keepclassmembers class com.lumora.wear.data.** { *; }

# Keep Google Play Services Wearable
-keep class com.google.android.gms.wearable.** { *; }

# Keep Compose runtime
-dontwarn androidx.compose.**
