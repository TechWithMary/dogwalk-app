import { PLACES_API_KEY } from './config';

export interface AddressSuggestion {
  description: string;
  placeId: string;
  mainText: string;
  secondaryText: string;
}

export async function searchAddressSuggestions(query: string): Promise<AddressSuggestion[]> {
  if (!query || query.length < 3) return [];

  try {
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&language=es&components=country:co&key=${PLACES_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.predictions) {
      return data.predictions.map((p: any) => ({
        description: p.description,
        placeId: p.place_id,
        mainText: p.structured_formatting?.main_text || p.description,
        secondaryText: p.structured_formatting?.secondary_text || '',
      }));
    }
  } catch (error) {
    console.error('Address search error:', error);
  }
  return [];
}

export async function getPlaceDetails(placeId: string): Promise<{ lat: number; lng: number; address: string } | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,formatted_address&key=${PLACES_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.result) {
      return {
        lat: data.result.geometry.location.lat,
        lng: data.result.geometry.location.lng,
        address: data.result.formatted_address,
      };
    }
  } catch (error) {
    console.error('Place details error:', error);
  }
  return null;
}