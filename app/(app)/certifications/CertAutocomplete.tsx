"use client";

import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { searchCertTemplates } from "@/constants/certifications";
import type { CertTemplate } from "@/constants/certifications";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (template: CertTemplate) => void;
  orgFilter?: string;
  hasError?: boolean;
};

export default function CertAutocomplete({
  value,
  onChange,
  onSelect,
  orgFilter,
  hasError,
}: Props) {
  const [suggestions, setSuggestions] = useState<CertTemplate[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [readOnly, setReadOnly] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Recompute suggestions whenever query or orgFilter changes
  useEffect(() => {
    if (open) {
      setSuggestions(searchCertTemplates(value, orgFilter));
    }
    setActiveIndex(-1);
  }, [value, orgFilter, open]);

  // Close on outside click
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  function handleFocus() {
    setReadOnly(false);
    setOpen(true);
    setSuggestions(searchCertTemplates(value, orgFilter));
  }

  function handleSelect(template: CertTemplate) {
    onSelect(template);
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
        name="fld-cert"
        autoComplete="off"
        data-form-type="other"
        data-lpignore="true"
        aria-autocomplete="list"
        aria-expanded={showDropdown}
        readOnly={readOnly}
        onFocus={handleFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          orgFilter
            ? "Select or type a certification…"
            : "e.g. CISSP or type your own"
        }
        className={`w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-transparent [&::-webkit-search-cancel-button]:hidden ${
          hasError
            ? "border-red-400 dark:border-red-500 focus:ring-red-400 dark:focus:ring-red-500"
            : "border-gray-300 dark:border-gray-600 focus:ring-blue-900 dark:focus:ring-blue-500"
        }`}
      />

      {showDropdown && (
        <ul className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto">
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
                  {cert.cpe_required} {cert.credit_type}
                  {cert.annual_minimum_cpe != null
                    ? ` · ${cert.annual_minimum_cpe}/yr`
                    : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
