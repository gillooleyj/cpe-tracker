"use client";

import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { ORGANIZATIONS } from "@/constants/certifications";
import type { OrgInfo } from "@/constants/certifications";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (org: OrgInfo) => void;
  hasError?: boolean;
};

function searchOrgs(query: string): OrgInfo[] {
  const q = query.toLowerCase().trim();
  if (!q) return ORGANIZATIONS;
  return ORGANIZATIONS.filter((o) => o.name.toLowerCase().includes(q));
}

export default function OrgAutocomplete({
  value,
  onChange,
  onSelect,
  hasError,
}: Props) {
  const [suggestions, setSuggestions] = useState<OrgInfo[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [readOnly, setReadOnly] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setSuggestions(searchOrgs(value));
    setActiveIndex(-1);
  }, [value, open]);

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  function handleFocus() {
    setReadOnly(false);
    setOpen(true);
    setSuggestions(searchOrgs(value));
  }

  function handleSelect(org: OrgInfo) {
    onSelect(org);
    setOpen(false);
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
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  const showDropdown = open && suggestions.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <input
        type="search"
        required
        role="combobox"
        name="organization-name-field"
        autoComplete="chrome-off"
        data-form-type="other"
        data-lpignore="true"
        aria-autocomplete="list"
        aria-expanded={showDropdown}
        readOnly={readOnly}
        onFocus={handleFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="e.g. ISC2 or type your own"
        className={`w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-transparent [&::-webkit-search-cancel-button]:hidden ${
          hasError
            ? "border-red-400 dark:border-red-500 focus:ring-red-400 dark:focus:ring-red-500"
            : "border-gray-300 dark:border-gray-600 focus:ring-blue-900 dark:focus:ring-blue-500"
        }`}
      />

      {showDropdown && (
        <ul className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto">
          {suggestions.map((org, i) => (
            <li key={org.name}>
              <button
                type="button"
                onMouseDown={() => handleSelect(org)}
                className={`w-full text-left px-3 py-2.5 flex items-center justify-between gap-4 transition-colors ${
                  i === activeIndex
                    ? "bg-blue-50 dark:bg-blue-900/40 text-blue-900 dark:text-blue-300"
                    : "hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200"
                }`}
              >
                <span className="font-medium text-sm">{org.name}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                  {org.creditType} · {org.cycleMonths} mo
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
