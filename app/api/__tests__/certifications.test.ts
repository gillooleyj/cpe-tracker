import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [] }),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
    })),
  },
}));

vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn() }));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeChain(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "insert", "update", "delete", "eq", "is", "limit", "single", "upsert", "from"];
  for (const m of methods) {
    chain[m] = vi.fn().mockImplementation(() => chain);
  }
  (chain as any).then = (resolve: (v: unknown) => void) => resolve({ error: null });
  for (const [k, v] of Object.entries(overrides)) chain[k] = v;
  return chain;
}

function makeRequest(body: unknown): Request {
  return {
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Request;
}

function makeBadJsonRequest(): Request {
  return {
    json: vi.fn().mockRejectedValue(new SyntaxError("bad json")),
  } as unknown as Request;
}

// Valid form fields for a full success path
const validBody = {
  name: "CISSP",
  organization: "ISC2",
  organization_url: "",
  issue_date: "2020-01-01",
  expiration_date: "2026-06-01",
  cpe_required: "120",
  cpe_cycle_length: "36",
  annual_minimum_cpe: "40",
  digital_certificate_url: "",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/certifications", () => {
  let POST: (req: Request) => Promise<{ body: unknown; status: number }>;
  let createServerClient: ReturnType<typeof vi.fn>;
  let mockSupabase: ReturnType<typeof makeChain>;

  beforeEach(async () => {
    vi.resetModules();

    // Re-mock after resetModules
    vi.doMock("next/headers", () => ({
      cookies: vi.fn().mockResolvedValue({ getAll: () => [] }),
    }));

    vi.doMock("next/server", () => ({
      NextResponse: {
        json: vi.fn((body: unknown, init?: { status?: number }) => ({
          body,
          status: init?.status ?? 200,
        })),
      },
    }));

    vi.doMock("@supabase/ssr", () => ({
      createServerClient: vi.fn(),
    }));

    // Dynamically import to get fresh module with fresh rate-limit state
    const mod = await import("@/app/api/certifications/route");
    POST = mod.POST as any;

    const ssr = await import("@supabase/ssr");
    createServerClient = ssr.createServerClient as ReturnType<typeof vi.fn>;

    mockSupabase = makeChain();
    createServerClient.mockReturnValue(mockSupabase);
  });

  it("returns 401 when not authenticated", async () => {
    mockSupabase.auth = {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("no auth") }),
    };
    createServerClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
    expect((res.body as any).error).toMatch(/Not authenticated/);
  });

  it("returns 401 when auth returns error with user", async () => {
    mockSupabase.auth = {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    };
    createServerClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 429 after exceeding rate limit", async () => {
    const userId = crypto.randomUUID();
    mockSupabase.auth = {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    };

    // single() resolves to success data
    const chain = makeChain();
    chain.single = vi.fn().mockResolvedValue({ data: { id: "cert-1" }, error: null });
    mockSupabase.from = vi.fn().mockReturnValue(chain);
    createServerClient.mockReturnValue(mockSupabase);

    // Make 10 successful requests to hit the limit
    for (let i = 0; i < 10; i++) {
      await POST(makeRequest(validBody));
    }

    // 11th should be rate limited
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(429);
    expect((res.body as any).error).toMatch(/Too many/);
  });

  it("returns 400 for invalid JSON body", async () => {
    const userId = crypto.randomUUID();
    mockSupabase.auth = {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    };
    createServerClient.mockReturnValue(mockSupabase);

    const res = await POST(makeBadJsonRequest());
    expect(res.status).toBe(400);
    expect((res.body as any).error).toMatch(/Invalid request body/);
  });

  it("returns 400 for validation errors", async () => {
    const userId = crypto.randomUUID();
    mockSupabase.auth = {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    };
    createServerClient.mockReturnValue(mockSupabase);

    const invalidBody = { ...validBody, name: "" };
    const res = await POST(makeRequest(invalidBody));
    expect(res.status).toBe(400);
    expect((res.body as any).errors).toBeDefined();
    expect((res.body as any).errors.name).toBeTruthy();
  });

  it("returns 500 when DB insert fails", async () => {
    const userId = crypto.randomUUID();
    mockSupabase.auth = {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    };

    const chain = makeChain();
    chain.single = vi.fn().mockResolvedValue({ data: null, error: { message: "db error" } });
    mockSupabase.from = vi.fn().mockReturnValue(chain);
    createServerClient.mockReturnValue(mockSupabase);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(makeRequest(validBody));
    consoleSpy.mockRestore();

    expect(res.status).toBe(500);
    expect((res.body as any).error).toMatch(/Failed to save/);
  });

  it("returns 201 with data on success", async () => {
    const userId = crypto.randomUUID();
    mockSupabase.auth = {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    };

    const certData = { id: "cert-uuid", name: "CISSP", user_id: userId };
    const chain = makeChain();
    chain.single = vi.fn().mockResolvedValue({ data: certData, error: null });
    mockSupabase.from = vi.fn().mockReturnValue(chain);
    createServerClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(201);
    expect((res.body as any).id).toBe("cert-uuid");
  });

  it("returns 500 for unexpected thrown error", async () => {
    // Make cookies() throw to trigger outer catch
    const { cookies } = await import("next/headers");
    (cookies as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("unexpected"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(makeRequest(validBody));
    consoleSpy.mockRestore();

    expect(res.status).toBe(500);
    expect((res.body as any).error).toMatch(/Unexpected server error/);
  });
});
