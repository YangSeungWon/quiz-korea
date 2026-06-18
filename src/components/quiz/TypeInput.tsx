import { useState, useRef, useEffect } from 'react';
import { useI18n } from '../../i18n/useI18n';

interface TypeInputProps {
  onSubmit: (input: string) => void;
  placeholder?: string;
  /** Increments on each wrong answer — triggers a shake + red flash. */
  wrongKey?: number;
}

export default function TypeInput({ onSubmit, placeholder, wrongKey }: TypeInputProps) {
  const { t } = useI18n();
  const [value, setValue] = useState('');
  const [wrong, setWrong] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const firstRun = useRef(true);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Wrong-answer feedback: shake the input and flash its border red.
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    setWrong(true);
    inputRef.current?.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-5px)' },
        { transform: 'translateX(5px)' },
        { transform: 'translateX(-3px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 300, easing: 'ease' },
    );
    const id = setTimeout(() => setWrong(false), 600);
    return () => clearTimeout(id);
  }, [wrongKey]);

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
        className={`flex-1 px-4 py-2 border rounded-lg text-center text-lg focus:outline-none focus:ring-2 ${
          wrong
            ? 'border-red-400 ring-2 ring-red-200 text-red-600'
            : 'border-gray-300 focus:ring-blue-400 focus:border-transparent'
        }`}
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
