import { useMemo } from 'react';
import { useMapData } from '../../hooks/useMapData';
import { getSidoList } from '../../utils/regionUtils';

interface RegionSelection {
  level: 'sido' | 'sigungu';
  filter?: string;
}

interface RegionPickerProps {
  value: RegionSelection;
  onChange: (selection: RegionSelection) => void;
}

export default function RegionPicker({ value, onChange }: RegionPickerProps) {
  const { geoData } = useMapData('sigungu');
  const sidoList = useMemo(() => (geoData ? getSidoList(geoData) : []), [geoData]);

  // Encode selection as a single string: "sido" or "sigungu:" or "sigungu:11"
  const encoded = value.level === 'sido' ? 'sido' : `sigungu:${value.filter ?? ''}`;

  const handleChange = (val: string) => {
    if (val === 'sido') {
      onChange({ level: 'sido' });
    } else if (val.startsWith('sigungu:')) {
      const filter = val.slice('sigungu:'.length) || undefined;
      onChange({ level: 'sigungu', filter });
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-600 mb-2">퀴즈 범위</label>
      <select
        value={encoded}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        <option value="sido">시도 전체 (17)</option>
        <optgroup label="시군구">
          <option value="sigungu:">전체 시군구</option>
          {sidoList.map((s) => (
            <option key={s.code} value={`sigungu:${s.code}`}>
              {s.name}
            </option>
          ))}
        </optgroup>
      </select>
    </div>
  );
}
