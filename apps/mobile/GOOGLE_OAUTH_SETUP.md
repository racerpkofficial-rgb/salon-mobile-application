# Google OAuth setup for Android

Google OAuth cannot complete in Expo Go for this app because Expo Go cannot register the app's custom OAuth return scheme. Use an EAS development build (or `npx expo run:android`) for Google Sign-In; Expo Go can still be used to test non-OAuth app features.

## Google Cloud Console

1. In **Google Auth Platform**, configure the consent screen and add test accounts if the app is still in Testing mode. The app requests only `openid`, `profile`, and `email`.
2. Under **Clients**, create an **Android** OAuth client:
   - Package name: `com.aurelia.salonbooking`
   - SHA-1: the certificate fingerprint that signs the APK being tested.
3. Register a separate Android client for each signing certificate that needs to be tested. The local Android debug keystore, EAS development/preview signing key, and Google Play app-signing key can have different SHA-1 fingerprints.
4. Create or retain a **Web application** OAuth client for the backend's accepted ID-token audience. Configure the existing `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and the backend's `GOOGLE_WEB_CLIENT_ID`/`GOOGLE_CLIENT_ID` with that same client ID. Set `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` and backend `GOOGLE_ANDROID_CLIENT_ID` to the Android client ID. Do not put a client secret in the mobile app.
5. Do not configure the retired Expo AuthSession proxy URI for this native flow. The app returns through `com.aurelia.salonbooking:/oauthredirect`, registered by the `scheme` and Android intent-filter settings in `app.json`.

For EAS builds, use the Android keystore associated with the build profile to obtain its SHA-1 fingerprint. For Play releases, also register the Play App Signing certificate fingerprint from **Play Console → Setup → App integrity**.

## Retest

After updating the client IDs and SHA-1 registrations, rebuild and install an Android development APK. Start Metro with `npx expo start --dev-client`, open the development build, and test customer and salon-owner Google login. Expo Go will display a development-build-required message instead of opening an unsupported proxy flow.
