/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import type { CertTemplate } from "@/constants/certifications";

// Mock searchCertTemplates before importing the component
vi.mock("@/constants/certifications", () => ({
  searchCertTemplates: vi.fn(),
}));

import { searchCertTemplates } from "@/constants/certifications";
import CertAutocomplete from "@/app/(app)/certifications/CertAutocomplete";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const templates: CertTemplate[] = [
  {
    name: "CISSP",
    organization: "ISC2",
    organization_url: "https://www.isc2.org",
    cpe_required: 120,
    cpe_cycle_length: 36,
    annual_minimum_cpe: 40,
    credit_type: "CPD",
  },
  {
    name: "CCSP",
    organization: "ISC2",
    organization_url: "https://www.isc2.org",
    cpe_required: 90,
    cpe_cycle_length: 36,
    annual_minimum_cpe: 30,
    credit_type: "CPD",
  },
  {
    name: "CISA",
    organization: "ISACA",
    organization_url: "https://www.isaca.org",
    cpe_required: 120,
    cpe_cycle_length: 36,
    annual_minimum_cpe: 20,
    credit_type: "CPD",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderComponent(props: {
  value?: string;
  onChange?: (v: string) => void;
  onSelect?: (t: CertTemplate) => void;
  orgFilter?: string;
  hasError?: boolean;
}) {
  const onChange = props.onChange ?? vi.fn();
  const onSelect = props.onSelect ?? vi.fn();
  return render(
    <CertAutocomplete
      value={props.value ?? ""}
      onChange={onChange}
      onSelect={onSelect}
      orgFilter={props.orgFilter}
      hasError={props.hasError}
    />
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("CertAutocomplete", () => {
  beforeEach(() => {
    vi.mocked(searchCertTemplates).mockReturnValue(templates);
  });

  describe("initial render", () => {
    it("renders an input with role=combobox", () => {
      renderComponent({});
      const input = screen.getByRole("combobox");
      expect(input).toBeTruthy();
    });

    it("starts as readOnly", () => {
      renderComponent({});
      const input = screen.getByRole("combobox") as HTMLInputElement;
      expect(input.readOnly).toBe(true);
    });

    it("shows default placeholder when no orgFilter", () => {
      renderComponent({});
      const input = screen.getByRole("combobox") as HTMLInputElement;
      expect(input.placeholder).toContain("e.g. CISSP");
    });

    it("shows alternative placeholder when orgFilter is set", () => {
      renderComponent({ orgFilter: "ISC2" });
      const input = screen.getByRole("combobox") as HTMLInputElement;
      expect(input.placeholder).toContain("Select or type");
    });

    it("shows the passed value", () => {
      renderComponent({ value: "CISSP" });
      const input = screen.getByRole("combobox") as HTMLInputElement;
      expect(input.value).toBe("CISSP");
    });

    it("does not show dropdown initially", () => {
      renderComponent({});
      // listbox / options should not be in document initially
      expect(screen.queryByRole("listbox")).toBeNull();
      // Or just check no buttons exist
      const buttons = screen.queryAllByRole("button");
      expect(buttons).toHaveLength(0);
    });

    it("applies error border classes when hasError is true", () => {
      renderComponent({ hasError: true });
      const input = screen.getByRole("combobox");
      expect(input.className).toContain("border-red");
    });

    it("applies normal border classes when hasError is false", () => {
      renderComponent({ hasError: false });
      const input = screen.getByRole("combobox");
      expect(input.className).not.toContain("border-red");
    });
  });

  describe("focus behavior", () => {
    it("sets readOnly to false on focus", async () => {
      renderComponent({});
      const input = screen.getByRole("combobox") as HTMLInputElement;
      await act(async () => {
        fireEvent.focus(input);
      });
      expect(input.readOnly).toBe(false);
    });

    it("opens dropdown on focus", async () => {
      renderComponent({});
      const input = screen.getByRole("combobox");
      await act(async () => {
        fireEvent.focus(input);
      });
      // Dropdown should show suggestions
      expect(screen.getByText("CISSP")).toBeTruthy();
    });

    it("calls searchCertTemplates on focus", async () => {
      renderComponent({ value: "CI" });
      const input = screen.getByRole("combobox");
      await act(async () => {
        fireEvent.focus(input);
      });
      expect(vi.mocked(searchCertTemplates)).toHaveBeenCalledWith("CI", undefined);
    });

    it("calls searchCertTemplates with orgFilter on focus", async () => {
      renderComponent({ value: "", orgFilter: "ISC2" });
      const input = screen.getByRole("combobox");
      await act(async () => {
        fireEvent.focus(input);
      });
      expect(vi.mocked(searchCertTemplates)).toHaveBeenCalledWith("", "ISC2");
    });

    it("shows all suggestions from mock on focus", async () => {
      renderComponent({});
      const input = screen.getByRole("combobox");
      await act(async () => {
        fireEvent.focus(input);
      });
      expect(screen.getByText("CISSP")).toBeTruthy();
      expect(screen.getByText("CCSP")).toBeTruthy();
      expect(screen.getByText("CISA")).toBeTruthy();
    });

    it("sets aria-expanded to true when dropdown is open", async () => {
      renderComponent({});
      const input = screen.getByRole("combobox");
      await act(async () => {
        fireEvent.focus(input);
      });
      expect(input.getAttribute("aria-expanded")).toBe("true");
    });
  });

  describe("keyboard navigation", () => {
    async function openDropdown() {
      renderComponent({});
      const input = screen.getByRole("combobox");
      await act(async () => {
        fireEvent.focus(input);
      });
      return input;
    }

    it("ArrowDown moves activeIndex down", async () => {
      const input = await openDropdown();
      await act(async () => {
        fireEvent.keyDown(input, { key: "ArrowDown" });
      });
      // First item should be highlighted (bg-blue-50 class on button)
      const buttons = screen.getAllByRole("button");
      expect(buttons[0].className).toContain("bg-blue");
    });

    it("ArrowDown does not go past last item", async () => {
      const input = await openDropdown();
      // Press ArrowDown many times (more than templates.length)
      for (let i = 0; i < 10; i++) {
        await act(async () => {
          fireEvent.keyDown(input, { key: "ArrowDown" });
        });
      }
      const buttons = screen.getAllByRole("button");
      // Last item should be highlighted
      expect(buttons[buttons.length - 1].className).toContain("bg-blue");
    });

    it("ArrowUp moves activeIndex up", async () => {
      const input = await openDropdown();
      // Go down twice first
      await act(async () => {
        fireEvent.keyDown(input, { key: "ArrowDown" });
        fireEvent.keyDown(input, { key: "ArrowDown" });
      });
      // Now go up once
      await act(async () => {
        fireEvent.keyDown(input, { key: "ArrowUp" });
      });
      // First item should be highlighted
      const buttons = screen.getAllByRole("button");
      expect(buttons[0].className).toContain("bg-blue");
    });

    it("ArrowUp does not go above -1 (no highlight)", async () => {
      const input = await openDropdown();
      // No items selected initially, ArrowUp should not crash
      await act(async () => {
        fireEvent.keyDown(input, { key: "ArrowUp" });
      });
      const buttons = screen.getAllByRole("button");
      for (const btn of buttons) {
        expect(btn.className).not.toContain("bg-blue");
      }
    });

    it("Enter selects active item and closes dropdown", async () => {
      const onSelect = vi.fn();
      render(
        <CertAutocomplete value="" onChange={vi.fn()} onSelect={onSelect} />
      );
      const input = screen.getByRole("combobox");
      await act(async () => {
        fireEvent.focus(input);
      });
      await act(async () => {
        fireEvent.keyDown(input, { key: "ArrowDown" });
      });
      await act(async () => {
        fireEvent.keyDown(input, { key: "Enter" });
      });
      expect(onSelect).toHaveBeenCalledWith(templates[0]);
      // Dropdown should be closed
      expect(screen.queryAllByRole("button")).toHaveLength(0);
    });

    it("Enter does nothing when no active item (index === -1)", async () => {
      const onSelect = vi.fn();
      render(
        <CertAutocomplete value="" onChange={vi.fn()} onSelect={onSelect} />
      );
      const input = screen.getByRole("combobox");
      await act(async () => {
        fireEvent.focus(input);
      });
      await act(async () => {
        fireEvent.keyDown(input, { key: "Enter" });
      });
      expect(onSelect).not.toHaveBeenCalled();
    });

    it("Escape closes dropdown", async () => {
      const input = await openDropdown();
      // Verify dropdown is open
      expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
      await act(async () => {
        fireEvent.keyDown(input, { key: "Escape" });
      });
      expect(screen.queryAllByRole("button")).toHaveLength(0);
    });
  });

  describe("click selection", () => {
    it("calls onSelect when a suggestion is clicked (mousedown)", async () => {
      const onSelect = vi.fn();
      render(
        <CertAutocomplete value="" onChange={vi.fn()} onSelect={onSelect} />
      );
      const input = screen.getByRole("combobox");
      await act(async () => {
        fireEvent.focus(input);
      });
      const buttons = screen.getAllByRole("button");
      await act(async () => {
        fireEvent.mouseDown(buttons[0]);
      });
      expect(onSelect).toHaveBeenCalledWith(templates[0]);
    });

    it("closes dropdown after clicking a suggestion", async () => {
      render(
        <CertAutocomplete value="" onChange={vi.fn()} onSelect={vi.fn()} />
      );
      const input = screen.getByRole("combobox");
      await act(async () => {
        fireEvent.focus(input);
      });
      const buttons = screen.getAllByRole("button");
      await act(async () => {
        fireEvent.mouseDown(buttons[1]);
      });
      expect(screen.queryAllByRole("button")).toHaveLength(0);
    });

    it("selects the correct template when second item is clicked", async () => {
      const onSelect = vi.fn();
      render(
        <CertAutocomplete value="" onChange={vi.fn()} onSelect={onSelect} />
      );
      const input = screen.getByRole("combobox");
      await act(async () => {
        fireEvent.focus(input);
      });
      const buttons = screen.getAllByRole("button");
      await act(async () => {
        fireEvent.mouseDown(buttons[1]);
      });
      expect(onSelect).toHaveBeenCalledWith(templates[1]);
    });
  });

  describe("empty suggestions", () => {
    it("does not show dropdown when searchCertTemplates returns empty array", async () => {
      vi.mocked(searchCertTemplates).mockReturnValue([]);
      renderComponent({});
      const input = screen.getByRole("combobox");
      await act(async () => {
        fireEvent.focus(input);
      });
      expect(screen.queryAllByRole("button")).toHaveLength(0);
    });

    it("aria-expanded is false when no suggestions", async () => {
      vi.mocked(searchCertTemplates).mockReturnValue([]);
      renderComponent({});
      const input = screen.getByRole("combobox");
      await act(async () => {
        fireEvent.focus(input);
      });
      expect(input.getAttribute("aria-expanded")).toBe("false");
    });
  });

  describe("value change", () => {
    it("calls onChange when input value changes", async () => {
      const onChange = vi.fn();
      render(
        <CertAutocomplete value="" onChange={onChange} onSelect={vi.fn()} />
      );
      const input = screen.getByRole("combobox");
      await act(async () => {
        fireEvent.focus(input);
      });
      await act(async () => {
        fireEvent.change(input, { target: { value: "CIS" } });
      });
      expect(onChange).toHaveBeenCalledWith("CIS");
    });
  });

  describe("outside click closes dropdown", () => {
    it("closes dropdown on mousedown outside container", async () => {
      renderComponent({});
      const input = screen.getByRole("combobox");
      await act(async () => {
        fireEvent.focus(input);
      });
      // Should be open
      expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
      // Simulate outside click
      await act(async () => {
        fireEvent.mouseDown(document.body);
      });
      expect(screen.queryAllByRole("button")).toHaveLength(0);
    });
  });

  describe("suggestion display", () => {
    it("displays cert name in suggestion", async () => {
      renderComponent({});
      const input = screen.getByRole("combobox");
      await act(async () => {
        fireEvent.focus(input);
      });
      expect(screen.getByText("CISSP")).toBeTruthy();
    });

    it("displays cpe_required and credit_type in suggestion", async () => {
      renderComponent({});
      const input = screen.getByRole("combobox");
      await act(async () => {
        fireEvent.focus(input);
      });
      // Multiple suggestions may show "120 CPD" (CISSP and CISA both have 120 CPD)
      const matches = screen.getAllByText(/120 CPD/);
      expect(matches.length).toBeGreaterThan(0);
    });

    it("displays annual_minimum_cpe when present", async () => {
      renderComponent({});
      const input = screen.getByRole("combobox");
      await act(async () => {
        fireEvent.focus(input);
      });
      expect(screen.getByText(/40\/yr/)).toBeTruthy();
    });

    it("does not display annual_minimum_cpe when null", async () => {
      vi.mocked(searchCertTemplates).mockReturnValue([
        {
          name: "GSEC",
          organization: "GIAC",
          organization_url: "https://www.giac.org",
          cpe_required: 36,
          cpe_cycle_length: 48,
          annual_minimum_cpe: null,
          credit_type: "CPD",
        },
      ]);
      renderComponent({});
      const input = screen.getByRole("combobox");
      await act(async () => {
        fireEvent.focus(input);
      });
      expect(screen.queryByText(/\/yr/)).toBeNull();
    });
  });
});
