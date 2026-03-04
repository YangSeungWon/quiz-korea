import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import type { RegionCollection, AdminLevel, MapData } from '../types';
import { buildSigunData } from './sigunMerge';

export async function loadKoreaMapData(level: AdminLevel): Promise<MapData> {
  // sigun uses sigungu data, merged at runtime
  const fileLevel = level === 'sigun' ? 'sigungu' : level;

  const response = await fetch(`/data/korea-${fileLevel}.json`);
  if (!response.ok) {
    throw new Error(`Failed to load ${fileLevel} data: ${response.statusText}`);
  }

  const data = await response.json();

  if (data.type === 'Topology') {
    const topology = data as Topology;
    const objectKey = Object.keys(topology.objects)[0];
    const geoData = feature(topology, topology.objects[objectKey]) as RegionCollection;

    if (level === 'sigun') {
      const { geoData: sigunGeo } = buildSigunData(topology, geoData);
      return { geoData: sigunGeo, topoData: topology };
    }

    return { geoData, topoData: topology };
  }

  // If already GeoJSON, wrap in a minimal topology placeholder
  return { geoData: data as RegionCollection, topoData: data as unknown as Topology };
}
