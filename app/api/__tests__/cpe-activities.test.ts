import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
  const methods = [
    "select", "insert", "update", "delete",
    "eq", "is", "in", "limit", "single", "upsert",
  ];
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

const validBody = {
  title: "Security Training",
  provider: "SANS Institute",
  activity_date: "2023-06-15",
  total_hours: 8,
  certifications: [{ id: "cert-uuid-1", hours_applied: 8 }],
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/cpe-activities", () => {
  let POST: (req: Request) => Promise<{ body: unknown; status: number }>;
  let createServerClient: ReturnType<typeof vi.fn>;
  let mockSupabase: ReturnType<typeof makeChain>;

  beforeEach(async () => {
    // Set fake time so "today" is after activity_date
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 15, 12, 0, 0));

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

    const mod = await import("@/app/api/cpe-activities/route");
    POST = mod.POST as any;

    const ssr = await import("@supabase/ssr");
    createServerClient = ssr.createServerClient as ReturnType<typeof vi.fn>;

    mockSupabase = makeChain();
    createServerClient.mockReturnValue(mockSupabase);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
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

  it("returns 401 when user is null (no error)", async () => {
    mockSupabase.auth = {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    };
    createServerClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
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

  it("returns 400 when title is missing", async () => {
    const userId = crypto.randomUUID();
    mockSupabase.auth = {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    };
    createServerClient.mockReturnValue(mockSupabase);

    const body = { ...validBody, title: "" };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    expect((res.body as any).errors.title).toBeTruthy();
  });

  it("returns 400 when provider is missing", async () => {
    const userId = crypto.randomUUID();
    mockSupabase.auth = {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    };
    createServerClient.mockReturnValue(mockSupabase);

    const body = { ...validBody, provider: "" };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    expect((res.body as any).errors.provider).toBeTruthy();
  });

  it("returns 400 when activity_date is missing", async () => {
    const userId = crypto.randomUUID();
    mockSupabase.auth = {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    };
    createServerClient.mockReturnValue(mockSupabase);

    const body = { ...validBody, activity_date: "" };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    expect((res.body as any).errors.activity_date).toBeTruthy();
  });

  it("returns 400 when activity_date is in the future", async () => {
    const userId = crypto.randomUUID();
    mockSupabase.auth = {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    };
    createServerClient.mockReturnValue(mockSupabase);

    const body = { ...validBody, activity_date: "2024-01-16" };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    expect((res.body as any).errors.activity_date).toMatch(/future/);
  });

  it("returns 400 when total_hours is zero", async () => {
    const userId = crypto.randomUUID();
    mockSupabase.auth = {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    };
    createServerClient.mockReturnValue(mockSupabase);

    const body = { ...validBody, total_hours: 0 };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    expect((res.body as any).errors.total_hours).toMatch(/greater than 0/);
  });

  it("returns 400 when certifications array is empty", async () => {
    const userId = crypto.randomUUID();
    mockSupabase.auth = {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    };
    createServerClient.mockReturnValue(mockSupabase);

    const body = { ...validBody, certifications: [] };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    expect((res.body as any).errors.certifications).toMatch(/At least one/);
  });

  it("returns 400 when a cert has zero hours_applied", async () => {
    const userId = crypto.randomUUID();
    mockSupabase.auth = {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    };
    createServerClient.mockReturnValue(mockSupabase);

    const body = { ...validBody, certifications: [{ id: "cert-1", hours_applied: 0 }] };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    expect((res.body as any).errors.certifications).toMatch(/Hours applied/);
  });

  it("returns 400 when a cert has hours_applied exceeding 500", async () => {
    const userId = crypto.randomUUID();
    mockSupabase.auth = {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    };
    createServerClient.mockReturnValue(mockSupabase);

    const body = { ...validBody, certifications: [{ id: "cert-1", hours_applied: 501 }] };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    expect((res.body as any).errors.certifications).toMatch(/cannot exceed 500/);
  });

  it("returns 500 when activity insert fails", async () => {
    const userId = crypto.randomUUID();
    mockSupabase.auth = {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    };

    const chain = makeChain();
    chain.single = vi.fn().mockResolvedValue({ data: null, error: { message: "insert failed" } });
    mockSupabase.from = vi.fn().mockReturnValue(chain);
    createServerClient.mockReturnValue(mockSupabase);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(makeRequest(validBody));
    consoleSpy.mockRestore();

    expect(res.status).toBe(500);
    expect((res.body as any).error).toMatch(/Failed to save activity/);
  });

  it("returns 500 when cert ownership check fails with a DB error", async () => {
    const userId = crypto.randomUUID();
    mockSupabase.auth = {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    };

    const activityData = { id: "activity-uuid", title: "Security Training", user_id: userId };
    const activityChain = makeChain();
    activityChain.single = vi.fn().mockResolvedValue({ data: activityData, error: null });

    const ownershipErrorChain = makeChain();
    (ownershipErrorChain as any).then = (resolve: (v: unknown) => void) =>
      resolve({ data: null, error: { message: "db error" } });

    mockSupabase.from = vi.fn().mockImplementation((table: string) => {
      if (table === "cpe_activities") return activityChain;
      if (table === "certifications") return ownershipErrorChain;
      return makeChain();
    });
    createServerClient.mockReturnValue(mockSupabase);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(makeRequest(validBody));
    consoleSpy.mockRestore();

    expect(res.status).toBe(500);
    expect((res.body as any).error).toMatch(/Failed to verify certifications/);
  });

  it("returns 403 when a cert does not belong to the authenticated user", async () => {
    const userId = crypto.randomUUID();
    mockSupabase.auth = {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    };

    const activityData = { id: "activity-uuid", title: "Security Training", user_id: userId };
    const activityChain = makeChain();
    activityChain.single = vi.fn().mockResolvedValue({ data: activityData, error: null });

    // Returns a different cert ID — not matching "cert-uuid-1"
    const ownershipChain = makeChain();
    (ownershipChain as any).then = (resolve: (v: unknown) => void) =>
      resolve({ data: [{ id: "other-cert-id" }], error: null });

    mockSupabase.from = vi.fn().mockImplementation((table: string) => {
      if (table === "cpe_activities") return activityChain;
      if (table === "certifications") return ownershipChain;
      return makeChain();
    });
    createServerClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(403);
    expect((res.body as any).error).toMatch(/Forbidden/);
  });

  it("returns 201 on success with activity data", async () => {
    const userId = crypto.randomUUID();
    mockSupabase.auth = {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    };

    const activityData = {
      id: "activity-uuid",
      title: "Security Training",
      user_id: userId,
    };

    const activityChain = makeChain();
    activityChain.single = vi.fn().mockResolvedValue({ data: activityData, error: null });

    const junctionChain = makeChain();
    (junctionChain as any).then = (resolve: (v: unknown) => void) => resolve({ error: null });

    const recalcSelectChain = makeChain();
    (recalcSelectChain as any).then = (resolve: (v: unknown) => void) =>
      resolve({ data: [{ hours_applied: 8 }] });

    // certifications is called twice: first for ownership check (SELECT), then for recalc (UPDATE)
    let certCallCount = 0;
    const ownershipChain = makeChain();
    (ownershipChain as any).then = (resolve: (v: unknown) => void) =>
      resolve({ data: [{ id: "cert-uuid-1" }], error: null });
    const certUpdateChain = makeChain();
    (certUpdateChain as any).then = (resolve: (v: unknown) => void) => resolve({ error: null });

    mockSupabase.from = vi.fn().mockImplementation((table: string) => {
      if (table === "cpe_activities") return activityChain;
      if (table === "certification_activities") {
        const caChain = makeChain();
        caChain.insert = vi.fn().mockReturnValue(junctionChain);
        caChain.select = vi.fn().mockReturnValue(recalcSelectChain);
        return caChain;
      }
      if (table === "certifications") {
        return ++certCallCount === 1 ? ownershipChain : certUpdateChain;
      }
      return makeChain();
    });

    createServerClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(201);
    expect((res.body as any).id).toBe("activity-uuid");
  });

  it("still returns 201 even if junction insert has an error (soft fail)", async () => {
    const userId = crypto.randomUUID();
    mockSupabase.auth = {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    };

    const activityData = { id: "activity-uuid-2", title: "Security Training", user_id: userId };
    const activityChain = makeChain();
    activityChain.single = vi.fn().mockResolvedValue({ data: activityData, error: null });

    const junctionChain = makeChain();
    (junctionChain as any).then = (resolve: (v: unknown) => void) =>
      resolve({ error: { message: "junction error" } });

    const recalcSelectChain = makeChain();
    (recalcSelectChain as any).then = (resolve: (v: unknown) => void) =>
      resolve({ data: [] });

    let certCallCount = 0;
    const ownershipChain = makeChain();
    (ownershipChain as any).then = (resolve: (v: unknown) => void) =>
      resolve({ data: [{ id: "cert-uuid-1" }], error: null });
    const certUpdateChain = makeChain();
    (certUpdateChain as any).then = (resolve: (v: unknown) => void) => resolve({ error: null });

    mockSupabase.from = vi.fn().mockImplementation((table: string) => {
      if (table === "cpe_activities") return activityChain;
      if (table === "certification_activities") {
        const caChain = makeChain();
        caChain.insert = vi.fn().mockReturnValue(junctionChain);
        caChain.select = vi.fn().mockReturnValue(recalcSelectChain);
        return caChain;
      }
      if (table === "certifications") {
        return ++certCallCount === 1 ? ownershipChain : certUpdateChain;
      }
      return makeChain();
    });

    createServerClient.mockReturnValue(mockSupabase);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(makeRequest(validBody));
    consoleSpy.mockRestore();

    expect(res.status).toBe(201);
  });

  it("accepts optional id field in body", async () => {
    const userId = crypto.randomUUID();
    mockSupabase.auth = {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    };

    const bodyWithId = { ...validBody, id: "frontend-uuid" };
    const activityData = { id: "frontend-uuid", title: "Security Training", user_id: userId };

    const activityChain = makeChain();
    activityChain.single = vi.fn().mockResolvedValue({ data: activityData, error: null });

    const recalcSelectChain = makeChain();
    (recalcSelectChain as any).then = (resolve: (v: unknown) => void) =>
      resolve({ data: [{ hours_applied: 8 }] });

    let certCallCount = 0;
    const ownershipChain = makeChain();
    (ownershipChain as any).then = (resolve: (v: unknown) => void) =>
      resolve({ data: [{ id: "cert-uuid-1" }], error: null });
    const certUpdateChain = makeChain();
    (certUpdateChain as any).then = (resolve: (v: unknown) => void) => resolve({ error: null });

    mockSupabase.from = vi.fn().mockImplementation((table: string) => {
      if (table === "cpe_activities") return activityChain;
      if (table === "certification_activities") {
        const caChain = makeChain();
        const junctionChain = makeChain();
        (junctionChain as any).then = (resolve: (v: unknown) => void) => resolve({ error: null });
        caChain.insert = vi.fn().mockReturnValue(junctionChain);
        caChain.select = vi.fn().mockReturnValue(recalcSelectChain);
        return caChain;
      }
      if (table === "certifications") {
        return ++certCallCount === 1 ? ownershipChain : certUpdateChain;
      }
      return makeChain();
    });

    createServerClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest(bodyWithId));
    expect(res.status).toBe(201);
    expect((res.body as any).id).toBe("frontend-uuid");
  });
});
