import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import type { RegionCollection, AdminLevel, MapData } from '../types';
import { buildSigunData } from './sigunMerge';

const cache = new Map<string, MapData>();

export async function loadKoreaMapData(level: AdminLevel): Promise<MapData> {
  if (cache.has(level)) return cache.get(level)!;

  // sigun uses sigungu data, merged at runtime
  const fileLevel = level === 'sigun' ? 'sigungu' : level;

  // Reuse raw fetch if sigungu was already loaded (or vice versa)
  let topology: Topology;
  let geoData: RegionCollection;

  if (fileLevel === 'sigungu' && cache.has('sigungu')) {
    const cached = cache.get('sigungu')!;
    topology = cached.topoData;
    geoData = cached.geoData;
  } else if (fileLevel === 'sigungu' && cache.has('sigun')) {
    // sigun cache has merged data but same topoData
    topology = cache.get('sigun')!.topoData;
    const objectKey = Object.keys(topology.objects)[0];
    geoData = feature(topology, topology.objects[objectKey]) as RegionCollection;
  } else {
    const response = await fetch(`/data/korea-${fileLevel}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load ${fileLevel} data: ${response.statusText}`);
    }
    const data = await response.json();

    if (data.type === 'Topology') {
      topology = data as Topology;
      const objectKey = Object.keys(topology.objects)[0];
      geoData = feature(topology, topology.objects[objectKey]) as RegionCollection;
    } else {
      const result: MapData = { geoData: data as RegionCollection, topoData: data as unknown as Topology };
      cache.set(level, result);
      return result;
    }
  }

  if (level === 'sigun') {
    const { geoData: sigunGeo, borderMesh } = buildSigunData(topology, geoData);
    const result: MapData = { geoData: sigunGeo, topoData: topology, borderMesh };
    cache.set(level, result);
    // Also cache sigungu raw data
    if (!cache.has('sigungu')) {
      cache.set('sigungu', { geoData, topoData: topology });
    }
    return result;
  }

  const result: MapData = { geoData, topoData: topology };
  cache.set(level, result);
  return result;
}
