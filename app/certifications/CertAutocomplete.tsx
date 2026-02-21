"use client";

import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { searchCertTemplates, type CertTemplate } from "@/lib/certTemplates";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (template: CertTemplate) => void;
};

export default function CertAutocomplete({ value, onChange, onSelect }: Props) {
  const [suggestions, setSuggestions] = useState<CertTemplate[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [readOnly, setReadOnly] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSuggestions(searchCertTemplates(value));
    setActiveIndex(-1);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSuggestions([]);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  function handleSelect(template: CertTemplate) {
    onSelect(template);
    setSuggestions([]);
    setActiveIndex(-1);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!suggestions.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setSuggestions([]);
      setActiveIndex(-1);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="search"
        required
        role="combobox"
        name="certification-name-field"
        autoComplete="chrome-off"
        data-form-type="other"
        data-lpignore="true"
        aria-autocomplete="list"
        aria-expanded={suggestions.length > 0}
        readOnly={readOnly}
        onFocus={() => setReadOnly(false)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="e.g. CISSP or type your own"
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-900 dark:focus:ring-blue-500 focus:border-transparent [&::-webkit-search-cancel-button]:hidden"
      />

      {suggestions.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden">
          {suggestions.map((cert, i) => (
            <li key={cert.name}>
              <button
                type="button"
                onMouseDown={() => handleSelect(cert)}
                className={`w-full text-left px-3 py-2.5 flex items-center justify-between gap-4 transition-colors ${
                  i === activeIndex
                    ? "bg-blue-50 dark:bg-blue-900/40 text-blue-900 dark:text-blue-300"
                    : "hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200"
                }`}
              >
                <span className="font-medium text-sm">{cert.name}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                  {cert.organization}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
