import { PLACES } from '../../engine';

const COUNTRIES: [string, string][] = [['CA', 'Canada'], ['US', 'United States']];

/** City <option>s grouped by country. */
export function PlaceOptions({ withRegion = false }: { withRegion?: boolean }) {
  return (
    <>
      {COUNTRIES.map(([code, name]) => (
        <optgroup key={code} label={name}>
          {PLACES.filter((p) => p.countryCode === code).map((p) => (
            <option key={p.id} value={p.id}>{p.name}{withRegion ? `, ${p.region}` : ''}</option>
          ))}
        </optgroup>
      ))}
    </>
  );
}
