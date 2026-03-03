import { useState, useEffect } from 'react';
import { loadKoreaMapData } from '../utils/dataLoader';
import type { RegionCollection, AdminLevel, MapData } from '../types';
import type { Topology } from 'topojson-specification';

export function useMapData(level: AdminLevel = 'sido') {
  const [geoData, setGeoData] = useState<RegionCollection | null>(null);
  const [topoData, setTopoData] = useState<Topology | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const result: MapData = await loadKoreaMapData(level);
        if (!cancelled) {
          setGeoData(result.geoData);
          setTopoData(result.topoData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Failed to load map data'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [level]);

  return { geoData, topoData, loading, error };
}
