# Issues - HappiWalk Completion

## Known Issues
- None yet (session just started)

## Potential Gotchas
- Web uses `navigator.geolocation` - mobile needs `expo-location`
- Web uses `@react-google-maps/api` - mobile needs `react-native-maps`
- Web MercadoPago uses web redirect - mobile may need in-app browser
- Supabase edge functions are outside mobile app codebase
- Admin panel needs role-based access control

## Watch Out For
- Column names must match Supabase schema exactly
- Status transitions must follow exact sequence
- Commission calculation must match web (20% + 4% = 76%)
- GPS tracking interval must be 10 seconds (matching web)
