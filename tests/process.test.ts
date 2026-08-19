import { describe, expect, it } from "vitest";

import { parseWindowsTaskList } from "@/lib/zomboid/process";

describe("Project Zomboid process parsing", () => {
  it("parses quoted tasklist CSV names", () => {
    const output = [
      '"System Idle Process","0","Services","0","8 K"',
      '"ProjectZomboid64.exe","1012","Console","1","1.024.000 K"',
      '"java.exe","2024","Console","1","512.000 K"',
    ].join("\r\n");

    expect(parseWindowsTaskList(output)).toEqual([
      "System Idle Process",
      "ProjectZomboid64.exe",
      "java.exe",
    ]);
  });

  it("does not need to treat arbitrary Java processes as Zomboid", () => {
    const names = parseWindowsTaskList(
      '"java.exe","2024","Console","1","512.000 K"',
    );
    expect(names).not.toContain("ProjectZomboid64.exe");
  });
});
