import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CACHE_TTL_MS } from "../config.js";

interface CacheEntry {
  createdAt: number;
  body: string;
}

export class ResponseCache {
  constructor(
    private readonly directory = join(process.cwd(), ".git-city-cache"),
    private readonly ttlMs = CACHE_TTL_MS,
    private readonly disabled = false,
  ) {}

  private fileFor(key: string): string {
    const name = createHash("sha256").update(key).digest("hex");
    return join(this.directory, `${name}.json`);
  }

  async get(key: string): Promise<string | undefined> {
    if (this.disabled) return undefined;
    try {
      const entry = JSON.parse(
        await readFile(this.fileFor(key), "utf8"),
      ) as CacheEntry;
      return Date.now() - entry.createdAt < this.ttlMs ? entry.body : undefined;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.warn(
          `Ignoring unreadable GitHub cache entry: ${String(error)}`,
        );
      }
      return undefined;
    }
  }

  async set(key: string, body: string): Promise<void> {
    if (this.disabled) return;
    await mkdir(this.directory, { recursive: true });
    const entry: CacheEntry = { createdAt: Date.now(), body };
    await writeFile(this.fileFor(key), JSON.stringify(entry), "utf8");
  }
}
