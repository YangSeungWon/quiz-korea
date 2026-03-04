import { useState, useRef, useEffect } from 'react';
import { useI18n } from '../../i18n/useI18n';

interface TypeInputProps {
  onSubmit: (input: string) => void;
  placeholder?: string;
}

export default function TypeInput({ onSubmit, placeholder }: TypeInputProps) {
  const { t } = useI18n();
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value.trim());
      setValue('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 justify-center max-w-sm mx-auto">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-center text-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
        autoComplete="off"
        spellCheck={false}
      />
      <button
        type="submit"
        className="px-5 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
      >
        {t('quiz.submit')}
      </button>
    </form>
  );
}
