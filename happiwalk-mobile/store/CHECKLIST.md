# HappiWalk - Pre-Launch Checklist

## ✅ Code Complete (101/107 tasks)
All automatable tasks done. Remaining 6 require external action.

---

## ⏳ App Store Submission

### Before You Begin
- [ ] Apple Developer Account ($99/year)
- [ ] App Store Connect access

### Screenshots (Manual)
- [ ] iPhone 14 Pro Max (1290 x 2796)
- [ ] iPhone 14/13 Pro (1179 x 2556)
- [ ] iPhone 14/13 Mini (1125 x 2436)

### Metadata
- [ ] App name: HappiWalk
- [ ] Description: See store/app-store-description.md
- [ ] Keywords: paseo, perro, mascota, walker, dog walk
- [ ] Privacy Policy URL: (host privacy-policy.html first)
- [ ] Support URL: your-support-url.com

### Build
- [ ] Run: `eas build --platform ios --profile production`
- [ ] Submit: `eas submit --platform ios`

---

## ⏳ Play Store Submission

### Before You Begin
- [ ] Google Play Console account ($25)
- [ ] Firebase project with google-services.json

### Assets (Manual)
- [ ] Feature graphic: 1024 x 500px
- [ ] Phone screenshots: 4-8 images
- [ ] Tablet screenshots: optional

### Metadata
- [ ] App name: HappiWalk
- [ ] Short description: See store/play-store-description.md
- [ ] Full description: See store/play-store-description.md
- [ ] Privacy Policy URL: (host privacy-policy.html first)
- [ ] Content rating: Complete questionnaire in Play Console

### Build
- [ ] Run: `eas build --platform android --profile production`
- [ ] Submit: `eas submit --platform android`

---

## 📋 Quick Commands

```bash
# Development
npm start
npx expo start --ios
npx expo start --android

# Production Build
eas build --platform ios --profile production
eas build --platform android --profile production

# Submit to Stores
eas submit --platform ios
eas submit --platform android
```

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| privacy-policy.html | Ready to host |
| store/app-store-description.md | App Store text |
| store/play-store-description.md | Play Store text |
| store/BUILD-INSTRUCTIONS.md | Build guide |
| store/SCREENSHOT-SPEC.md | Screenshot specs |
| .env.example | Environment template |
| eas.json | Build configuration |