# Draft: Address Search Fix

## Problem Reported
- When user taps GPS button, "No se encontraron direcciones" appears
- Address autocomplete not working

## Observations
1. **No .env file exists** - API key may not be configured
2. **app.json has hardcoded keys**:
   - iOS: `AIzaSyA_JTieFhnhzWENbxRsiFAeK1R_oWVT2R4`
   - Android: `AIzaSyAl2je5gnJuDuhFlM1tjdFUF99vDREa9gc`
3. **config.ts reads from env**: `GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || ''`
4. **Code flow**: booking.tsx → searchAddressSuggestions → Google Places API

## User Decision
- User will configure .env file with API key themselves

## Plan Needed (after user confirms)
1. Verify .env file exists and has EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
2. Test address search in booking screen
3. If still failing, debug the API call

## Files Involved
- `lib/addressSearch.ts` - API calls to Google Places
- `lib/config.ts` - API key retrieval
- `app/booking.tsx` - Address input UI
- `app.json` - Fallback hardcoded keys (may be obsolete)

## Questions
- Which API key format is correct? Standard Google Places key?
- Should hardcoded keys in app.json be removed?