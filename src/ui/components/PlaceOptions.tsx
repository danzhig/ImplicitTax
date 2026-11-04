import { PLACES, type Place } from '../../engine';

export type Region = 'CA' | 'US' | 'EU' | 'ASIA';
export const REGIONS: [Region, string][] = [['CA', 'Canada'], ['US', 'United States'], ['EU', 'Europe'], ['ASIA', 'Asia']];
export const regionOf = (p: Place): Region => (p.countryCode === 'CA' || p.countryCode === 'US' ? p.countryCode : p.countryCode === 'SG' ? 'ASIA' : 'EU');

/** City <option>s grouped by region. */
export function PlaceOptions({ withRegion = false }: { withRegion?: boolean }) {
  return (
    <>
      {REGIONS.map(([code, name]) => (
        <optgroup key={code} label={name}>
          {PLACES.filter((p) => regionOf(p) === code).map((p) => (
            <option key={p.id} value={p.id}>{p.name}{withRegion && p.country !== p.name ? `, ${p.region === p.name ? p.country : p.region}` : ''}</option>
          ))}
        </optgroup>
      ))}
    </>
  );
}
