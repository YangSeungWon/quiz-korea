import { useEffect, useMemo } from 'react';
import { useMapData } from '../../hooks/useMapData';
import { getSidoList } from '../../utils/regionUtils';

interface SidoFilterPickerProps {
  value?: string;
  onChange: (sidoCode: string | undefined) => void;
}

export default function SidoFilterPicker({ value, onChange }: SidoFilterPickerProps) {
  const { geoData } = useMapData('sigungu');

  const sidoList = useMemo(() => (geoData ? getSidoList(geoData) : []), [geoData]);

  // Default to first sido when no filter selected and list is available
  useEffect(() => {
    if (!value && sidoList.length > 0) {
      onChange(sidoList[0].code);
    }
  }, [value, sidoList, onChange]);

  if (sidoList.length === 0) return null;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-600 mb-2">시도 선택</label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        <option value="">전체</option>
        {sidoList.map((s) => (
          <option key={s.code} value={s.code}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  );
}
