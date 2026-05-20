# HappiWalk - Build & Submission Guide

## Completed Tasks (101/107)
All code work is done. The following tasks require manual action.

---

## Remaining Manual Tasks

### 1. App Store Screenshots
**Required**: Physical iPhone (6.7", 6.5", 5.5")

**Screens to capture**:
1. Home screen (Owner view)
2. Booking flow - Select walker
3. Walker profile
4. Chat screen
5. Profile/Settings

**Instructions**:
1. Run app on physical iPhone: `npx expo start --ios`
2. Use Simulator or physical device
3. Press Cmd+Shift+4 (Mac) to capture
4. Save as PNG files

---

### 2. Privacy Policy URL
**Required**: Web hosting

**File ready**: `privacy-policy.html` (already created)

**Options**:
- **GitHub Pages**: Upload to repo, enable Pages
- **Netlify**: Drag and drop the file
- **Custom domain**: Upload to your server

**URL format**: `https://your-domain.com/privacy-policy.html`

---

### 3. Play Store Feature Graphic
**Required**: 1024x500px image

**Design requirements**:
- Use app colors: #13ec13 (green), #111827 (dark)
- Include app name "HappiWalk"
- Show dog walking imagery
- No text overlay required

**Tools**: Canva, Figma, Photoshop

---

### 4. Content Rating (Google Play)
**Required**: Google Play Console access

**Steps**:
1. Go to play.google.com/console
2. Select app → Content rating
3. Complete questionnaire (5-10 min)
4. Save rating

---

### 5. iOS Production Build
**Required**: Apple Developer Account ($99/year)

**Command**:
```bash
eas build --platform ios --profile production
```

**Prerequisites**:
- Apple Developer account configured
- Run `eas login` first

---

### 6. Android Production Build
**Required**: Google Play account ($25) + google-services.json

**Command**:
```bash
eas build --platform android --profile production
```

**Prerequisites**:
1. Create project in Firebase Console
2. Download google-services.json
3. Place in project root
4. Run `eas login`

---

## Quick Reference

| Task | Command | Account Needed |
|------|---------|----------------|
| iOS build | `eas build --platform ios --profile production` | Apple Developer |
| Android build | `eas build --platform android --profile production` | Google Play |
| Submit iOS | `eas submit --platform ios` | App Store Connect |
| Submit Android | `eas submit --platform android` | Google Play |

---

## App Info
- **Bundle ID**: com.happiwalk.app
- **Version**: 1.0.0
- **Name**: HappiWalk
- **Privacy Policy**: privacy-policy.html (ready to host)