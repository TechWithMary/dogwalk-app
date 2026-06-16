/** Razas frecuentes en Colombia + opción personalizada. Orden: criollos primero, luego alfabético, Otro al final. */
export const PET_BREEDS = [
  'Criollo / Mestizo',
  'Akita',
  'Alaskan Malamute',
  'American Bully',
  'Australian Shepherd',
  'Basenji',
  'Basset Hound',
  'Beagle',
  'Bernese Mountain Dog',
  'Bloodhound',
  'Border Collie',
  'Boston Terrier',
  'Boxer',
  'Braco Alemán',
  'Bulldog Francés',
  'Bulldog Inglés',
  'Caniche (Poodle)',
  'Cane Corso',
  'Cavalier King Charles',
  'Chihuahua',
  'Chow Chow',
  'Cocker Spaniel',
  'Cocker Spaniel Americano',
  'Dachshund (Salchicha)',
  'Dalmatian',
  'Doberman',
  'Dogo Argentino',
  'Fox Terrier',
  'Galgo',
  'Golden Retriever',
  'Gran Danés',
  'Jack Russell Terrier',
  'Labrador Retriever',
  'Lhasa Apso',
  'Maltés',
  'Mastín',
  'Papillon',
  'Pastor Alemán',
  'Pastor Belga',
  'Pastor de Shetland',
  'Pinscher Miniatura',
  'Pitbull / American Staffordshire',
  'Pomerania',
  'Pug',
  'Rhodesian Ridgeback',
  'Rottweiler',
  'Samoyedo',
  'San Bernardo',
  'Schnauzer Miniatura',
  'Schnauzer Mediano',
  'Setter Inglés',
  'Shar Pei',
  'Shih Tzu',
  'Siberian Husky',
  'Staffordshire Terrier',
  'Weimaraner',
  'West Highland White Terrier',
  'Yorkshire Terrier',
  'Otro',
] as const;

export const OTHER_BREED_OPTION = 'Otro';

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export function filterPetBreeds(query: string): string[] {
  const q = normalize(query);
  if (!q) return [...PET_BREEDS];

  const matches = PET_BREEDS.filter((breed) => normalize(breed).includes(q));
  const hasOtro = matches.includes(OTHER_BREED_OPTION);
  if (!hasOtro && (q.includes('otr') || q === 'o')) {
    return [...matches, OTHER_BREED_OPTION];
  }
  return matches;
}

export function canUseCustomBreed(query: string, filtered: string[]): boolean {
  const trimmed = query.trim();
  if (trimmed.length < 2) return false;
  const q = normalize(trimmed);
  return !filtered.some((breed) => normalize(breed) === q);
}

export function isKnownBreed(breed: string): boolean {
  return PET_BREEDS.some((item) => normalize(item) === normalize(breed));
}
