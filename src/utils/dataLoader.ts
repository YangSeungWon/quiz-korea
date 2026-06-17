import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import type { RegionCollection, AdminLevel, MapData } from '../types';
import { buildSigunData } from './sigunMerge';

const cache = new Map<string, MapData>();

export async function loadKoreaMapData(level: AdminLevel, filter?: string): Promise<MapData> {
  // 동(읍면동): one file per 시도, picked from the sigungu filter's 시도 prefix.
  if (level === 'dong') {
    const sido = (filter || '').substring(0, 2);
    if (!sido) throw new Error('dong level requires a sigungu filter');
    const cacheKey = `dong-${sido}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey)!;
    const response = await fetch(`/data/dong/korea-dong-${sido}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load dong data (${sido}): ${response.statusText}`);
    }
    const topology = (await response.json()) as Topology;
    const objectKey = Object.keys(topology.objects)[0];
    const geoData = feature(topology, topology.objects[objectKey]) as RegionCollection;
    const result: MapData = { geoData, topoData: topology };
    cache.set(cacheKey, result);
    return result;
  }

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
