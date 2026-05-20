// Google Maps API Key (for native iOS/Android Maps SDK)
export const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

// Places API Key (for address autocomplete web service)
export const PLACES_API_KEY = process.env.EXPO_PUBLIC_PLACES_API_KEY || '';

// Mercado Pago Public Key
export const MERCADOPAGO_PUBLIC_KEY = process.env.EXPO_PUBLIC_MERCADOPAGO_PUBLIC_KEY || '';

// Medellín center coordinates
export const MEDELLIN_CENTER = {
  latitude: 6.2476,
  longitude: -75.5658
};

export const MEDELLIN_REGION = {
  latitude: 6.2476,
  longitude: -75.5658,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05
};
