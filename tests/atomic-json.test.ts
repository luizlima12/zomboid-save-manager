import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { writeJsonAtomic } from "@/lib/filesystem/atomic-json";

describe("atomic JSON", () => {
  let testRoot: string;

  beforeEach(async () => {
    testRoot = await mkdtemp(path.join(os.tmpdir(), "zsm-json-test-"));
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true });
  });

  it("keeps a valid document during concurrent first-run writes", async () => {
    const filePath = path.join(testRoot, "data", "config.json");
    const candidates = Array.from({ length: 6 }, (_, index) => ({ index }));

    await Promise.all(
      candidates.map((candidate) => writeJsonAtomic(filePath, candidate)),
    );

    const result = JSON.parse(await readFile(filePath, "utf8")) as {
      index: number;
    };
    expect(candidates).toContainEqual(result);
  });
});
