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
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
vi.mock("bcryptjs", () => ({ default: { compare: vi.fn().mockResolvedValue(true) } }));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeChain(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "insert", "update", "delete", "eq", "is", "limit", "single", "upsert"];
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

const validBody = {
  code: "ABCDE-12345",
  factorId: "factor-uuid",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/auth/use-backup-code", () => {
  let POST: (req: Request) => Promise<{ body: unknown; status: number }>;
  let createServerClient: ReturnType<typeof vi.fn>;
  let createClient: ReturnType<typeof vi.fn>;
  let mockSupabase: ReturnType<typeof makeChain>;
  let mockAdmin: { auth: { admin: { mfa: { deleteFactor: ReturnType<typeof vi.fn> } } } };
  let mockBcrypt: { compare: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.resetModules();

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

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: vi.fn(),
    }));

    vi.doMock("bcryptjs", () => ({
      default: { compare: vi.fn().mockResolvedValue(true) },
    }));

    // Set env vars
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

    const mod = await import("@/app/api/auth/use-backup-code/route");
    POST = mod.POST as any;

    const ssr = await import("@supabase/ssr");
    createServerClient = ssr.createServerClient as ReturnType<typeof vi.fn>;

    const supabaseJs = await import("@supabase/supabase-js");
    createClient = supabaseJs.createClient as ReturnType<typeof vi.fn>;

    const bcryptMod = await import("bcryptjs");
    mockBcrypt = bcryptMod.default as unknown as { compare: ReturnType<typeof vi.fn> };

    // Setup default mock admin client
    mockAdmin = {
      auth: {
        admin: {
          mfa: {
            deleteFactor: vi.fn().mockResolvedValue({ error: null }),
          },
        },
      },
    };
    createClient.mockReturnValue(mockAdmin);

    // Setup default mock SSR supabase client
    mockSupabase = makeChain();
    // Use a unique user ID per test run to avoid rate-limit collisions
    const userId = crypto.randomUUID();
    mockSupabase.auth = {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    };

    // Default: lookup returns rows with code_hash (bcrypt compare will return true)
    const lookupChain = makeChain();
    (lookupChain as any).then = (resolve: (v: unknown) => void) =>
      resolve({ data: [{ id: "backup-code-row-id", code_hash: "$2b$10$storedHash" }], error: null });

    const updateChain = makeChain();
    (updateChain as any).then = (resolve: (v: unknown) => void) => resolve({ error: null });

    const deleteChain = makeChain();
    (deleteChain as any).then = (resolve: (v: unknown) => void) => resolve({ error: null });

    mockSupabase.from = vi.fn().mockImplementation((_table: string) => {
      const chain = makeChain();
      // select → lookup chain
      chain.select = vi.fn().mockReturnValue(lookupChain);
      // update → update chain
      chain.update = vi.fn().mockReturnValue(updateChain);
      // delete → delete chain
      chain.delete = vi.fn().mockReturnValue(deleteChain);
      return chain;
    });

    createServerClient.mockReturnValue(mockSupabase);
  });

  it("returns 400 when code is missing", async () => {
    const res = await POST(makeRequest({ factorId: "factor-uuid" }));
    expect(res.status).toBe(400);
    expect((res.body as any).error).toMatch(/Missing code or factorId/);
  });

  it("returns 400 when factorId is missing", async () => {
    const res = await POST(makeRequest({ code: "ABCDE-12345" }));
    expect(res.status).toBe(400);
    expect((res.body as any).error).toMatch(/Missing code or factorId/);
  });

  it("returns 400 when both code and factorId are missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    expect((res.body as any).error).toMatch(/Missing code or factorId/);
  });

  it("returns 401 when user is not authenticated", async () => {
    mockSupabase.auth = {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("no auth") }),
    };
    createServerClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
    expect((res.body as any).error).toMatch(/Not authenticated/);
  });

  it("returns 401 when getUser returns null user with no error", async () => {
    mockSupabase.auth = {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    };
    createServerClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 429 after 5 attempts from the same user", async () => {
    // Use a fixed user ID to trigger rate limiting
    const fixedUserId = "rate-limit-test-" + crypto.randomUUID();
    mockSupabase.auth = {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: fixedUserId } },
        error: null,
      }),
    };
    createServerClient.mockReturnValue(mockSupabase);

    // 5 allowed attempts
    for (let i = 0; i < 5; i++) {
      await POST(makeRequest(validBody));
    }

    // 6th attempt should be rate-limited
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(429);
    expect((res.body as any).error).toMatch(/Too many attempts/);
  });

  it("returns 500 when DB lookup returns error", async () => {
    const errorLookupChain = makeChain();
    (errorLookupChain as any).then = (resolve: (v: unknown) => void) =>
      resolve({ data: null, error: { message: "db error" } });

    mockSupabase.from = vi.fn().mockImplementation((_table: string) => {
      const chain = makeChain();
      chain.select = vi.fn().mockReturnValue(errorLookupChain);
      return chain;
    });
    createServerClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
    expect((res.body as any).error).toMatch(/Database error/);
  });

  it("returns 400 when no backup codes match (bcrypt compare returns false)", async () => {
    mockBcrypt.compare.mockResolvedValue(false);

    const lookupChain = makeChain();
    (lookupChain as any).then = (resolve: (v: unknown) => void) =>
      resolve({ data: [{ id: "backup-code-row-id", code_hash: "$2b$10$storedHash" }], error: null });

    mockSupabase.from = vi.fn().mockImplementation((_table: string) => {
      const chain = makeChain();
      chain.select = vi.fn().mockReturnValue(lookupChain);
      return chain;
    });
    createServerClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(400);
    expect((res.body as any).error).toMatch(/Invalid or already-used/);
  });

  it("returns 400 when backup code is not found (empty rows)", async () => {
    const emptyLookupChain = makeChain();
    (emptyLookupChain as any).then = (resolve: (v: unknown) => void) =>
      resolve({ data: [], error: null });

    mockSupabase.from = vi.fn().mockImplementation((_table: string) => {
      const chain = makeChain();
      chain.select = vi.fn().mockReturnValue(emptyLookupChain);
      return chain;
    });
    createServerClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(400);
    expect((res.body as any).error).toMatch(/Invalid or already-used/);
  });

  it("returns 400 when rows is null", async () => {
    const nullLookupChain = makeChain();
    (nullLookupChain as any).then = (resolve: (v: unknown) => void) =>
      resolve({ data: null, error: null });

    mockSupabase.from = vi.fn().mockImplementation((_table: string) => {
      const chain = makeChain();
      chain.select = vi.fn().mockReturnValue(nullLookupChain);
      return chain;
    });
    createServerClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(400);
    expect((res.body as any).error).toMatch(/Invalid or already-used/);
  });

  it("returns 500 when update (mark used) fails", async () => {
    const lookupChain = makeChain();
    (lookupChain as any).then = (resolve: (v: unknown) => void) =>
      resolve({ data: [{ id: "backup-code-row-id", code_hash: "$2b$10$storedHash" }], error: null });

    const errorUpdateChain = makeChain();
    (errorUpdateChain as any).then = (resolve: (v: unknown) => void) =>
      resolve({ error: { message: "update failed" } });

    mockSupabase.from = vi.fn().mockImplementation((_table: string) => {
      const chain = makeChain();
      chain.select = vi.fn().mockReturnValue(lookupChain);
      chain.update = vi.fn().mockReturnValue(errorUpdateChain);
      return chain;
    });
    createServerClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
    expect((res.body as any).error).toMatch(/Failed to mark code as used/);
  });

  it("returns 500 when service role key is missing", async () => {
    const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const lookupChain = makeChain();
    (lookupChain as any).then = (resolve: (v: unknown) => void) =>
      resolve({ data: [{ id: "backup-code-row-id", code_hash: "$2b$10$storedHash" }], error: null });

    const updateChain = makeChain();
    (updateChain as any).then = (resolve: (v: unknown) => void) => resolve({ error: null });

    mockSupabase.from = vi.fn().mockImplementation((_table: string) => {
      const chain = makeChain();
      chain.select = vi.fn().mockReturnValue(lookupChain);
      chain.update = vi.fn().mockReturnValue(updateChain);
      return chain;
    });
    createServerClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest(validBody));
    process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;

    expect(res.status).toBe(500);
    expect((res.body as any).error).toMatch(/service role key/);
  });

  it("returns 500 when deleteFactor fails", async () => {
    mockAdmin.auth.admin.mfa.deleteFactor.mockResolvedValue({
      error: { message: "delete factor failed" },
    });

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
    expect((res.body as any).error).toMatch(/Failed to remove authenticator/);
  });

  it("returns 200 with success on valid backup code", async () => {
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    expect((res.body as any).success).toBe(true);
  });

  it("normalizes code: strips dash and uppercases before comparing", async () => {
    // lowercase code with dash should be normalized before bcrypt.compare
    const res = await POST(makeRequest({ code: "abcde-12345", factorId: "factor-uuid" }));
    expect(res.status).toBe(200);
    expect((res.body as any).success).toBe(true);
  });

  it("returns 500 for unexpected errors (bad cookies)", async () => {
    const { cookies } = await import("next/headers");
    (cookies as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("unexpected"));

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
    expect((res.body as any).error).toMatch(/Unexpected server error/);
  });
});
