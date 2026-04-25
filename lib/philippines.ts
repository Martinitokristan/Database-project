export interface LocationItem {
  code: string;
  name: string;
  isRegion?: boolean;
}

export async function fetchProvinces(): Promise<LocationItem[]> {
  try {
    const [provRes, ncrRes] = await Promise.all([
      fetch('https://psgc.gitlab.io/api/provinces/'),
      fetch('https://psgc.gitlab.io/api/regions/130000000/')
    ]);
    
    const provinces = await provRes.json();
    const ncr = await ncrRes.json();

    const all = [
      ...provinces.map((p: any) => ({ code: p.code, name: p.name, isRegion: false })),
      { code: ncr.code, name: 'Metro Manila (NCR)', isRegion: true }
    ];

    return all.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Failed to fetch provinces:', error);
    return [];
  }
}

export async function fetchCities(locationCode: string, isRegion: boolean = false): Promise<LocationItem[]> {
  if (!locationCode) return [];
  try {
    const url = isRegion 
      ? `https://psgc.gitlab.io/api/regions/${locationCode}/cities-municipalities/`
      : `https://psgc.gitlab.io/api/provinces/${locationCode}/cities-municipalities/`;
    
    const res = await fetch(url);
    const cities = await res.json();
    
    return cities.map((c: any) => ({ code: c.code, name: c.name })).sort((a: any, b: any) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Failed to fetch cities:', error);
    return [];
  }
}
