"use client";

import { useEffect, useRef, useState, KeyboardEvent, ClipboardEvent } from "react";
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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setSuggestions(searchCertTemplates(value, orgFilter));
    setActiveIndex(-1);
  }, [value, orgFilter, open]);

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
    setOpen(true);
    setSuggestions(searchCertTemplates(value, orgFilter));
  }

  function handleSelect(template: CertTemplate) {
    onSelect(template);
    setOpen(false);
    setActiveIndex(-1);
  }

  // The input is permanently readOnly so Safari never triggers contact autofill.
  // Key events still fire on readOnly inputs — we intercept them and manually
  // update the value via onChange instead of letting the browser do it.
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) { setOpen(true); setSuggestions(searchCertTemplates(value, orgFilter)); }
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
    } else if (e.key === "Backspace") {
      e.preventDefault();
      onChange(value.slice(0, -1));
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      onChange(value + e.key);
      if (!open) setOpen(true);
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    onChange(text);
    if (!open) setOpen(true);
  }

  const showDropdown = open && suggestions.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        readOnly
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showDropdown}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        value={value}
        placeholder={
          orgFilter
            ? "Select or type a certification…"
            : "e.g. CISSP or type your own"
        }
        className={`w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-transparent ${
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
