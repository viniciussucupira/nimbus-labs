/**
 * A Redis that lives in memory, for testing the parts of this codebase whose
 * behaviour only shows up across several commands.
 *
 * Pure functions can be checked by calling them. What cannot be checked that
 * way is a flow: a first message becoming a request, the request being
 * accepted, a decline taking the messages with it and shutting the sender out.
 * Those live in the order of the writes, not in any one function, and the only
 * honest way to check them without two people and two inboxes is to run them
 * against something that behaves like the store they were written for.
 *
 * It implements only the commands this codebase actually uses, and it answers
 * in the shapes Upstash's REST API answers in — a flat array for ZREVRANGE
 * WITHSCORES, null for a missing ZSCORE, the integer 1 or 0 for SISMEMBER.
 * Anything not implemented throws by name rather than quietly returning null,
 * so a test can never pass because a command silently did nothing.
 *
 * This is not a Redis. It is a test double, kept beside the code it doubles so
 * that a command added to one is noticed as missing in the other.
 */

type Entry = string | string[] | Map<string, string> | Set<string> | { score: number; member: string }[];

export class MemoryRedis {
  private data = new Map<string, Entry>();

  /** Everything, thrown away. */
  clear(): void {
    this.data.clear();
  }

  /** For a test to look at what a flow left behind. */
  keys(): string[] {
    return [...this.data.keys()].sort();
  }

  private list(key: string): string[] {
    const held = this.data.get(key);
    if (Array.isArray(held) && (held.length === 0 || typeof held[0] === "string")) return held as string[];
    const made: string[] = [];
    this.data.set(key, made);
    return made;
  }

  private hash(key: string): Map<string, string> {
    const held = this.data.get(key);
    if (held instanceof Map) return held;
    const made = new Map<string, string>();
    this.data.set(key, made);
    return made;
  }

  private set(key: string): Set<string> {
    const held = this.data.get(key);
    if (held instanceof Set) return held;
    const made = new Set<string>();
    this.data.set(key, made);
    return made;
  }

  private zset(key: string): { score: number; member: string }[] {
    const held = this.data.get(key);
    if (Array.isArray(held) && (held.length === 0 || typeof held[0] === "object")) {
      return held as { score: number; member: string }[];
    }
    const made: { score: number; member: string }[] = [];
    this.data.set(key, made);
    return made;
  }

  /** Runs one command, the way redisPipeline runs each of its own. */
  run(command: (string | number)[]): unknown {
    const [rawName, ...rest] = command;
    const name = String(rawName).toUpperCase();
    const key = String(rest[0] ?? "");
    const args = rest.slice(1).map(String);

    switch (name) {
      case "SET":
        this.data.set(key, args[0]);
        return "OK";
      case "GET": {
        const held = this.data.get(key);
        return typeof held === "string" ? held : null;
      }
      case "DEL": {
        // DEL takes several keys.
        let gone = 0;
        for (const one of [key, ...args]) if (this.data.delete(one)) gone += 1;
        return gone;
      }
      case "EXISTS":
        return this.data.has(key) ? 1 : 0;

      case "RPUSH": {
        const list = this.list(key);
        list.push(...args);
        return list.length;
      }
      case "LTRIM": {
        const list = this.list(key);
        const [from, to] = [Number(args[0]), Number(args[1])];
        const start = from < 0 ? Math.max(0, list.length + from) : from;
        const end = to < 0 ? list.length + to : to;
        this.data.set(key, list.slice(start, end + 1));
        return "OK";
      }
      case "LRANGE": {
        const list = this.list(key);
        const [from, to] = [Number(args[0]), Number(args[1])];
        const start = from < 0 ? Math.max(0, list.length + from) : from;
        const end = to < 0 ? list.length + to : to;
        return list.slice(start, end + 1);
      }

      case "HSET": {
        const hash = this.hash(key);
        for (let i = 0; i + 1 < args.length; i += 2) hash.set(args[i], args[i + 1]);
        return 1;
      }
      case "HSETNX": {
        const hash = this.hash(key);
        if (hash.has(args[0])) return 0;
        hash.set(args[0], args[1]);
        return 1;
      }
      case "HGET":
        return this.hash(key).get(args[0]) ?? null;
      case "HMGET":
        return args.map((field) => this.hash(key).get(field) ?? null);
      case "HDEL": {
        const hash = this.hash(key);
        let gone = 0;
        for (const field of args) if (hash.delete(field)) gone += 1;
        return gone;
      }
      case "HGETALL": {
        const flat: string[] = [];
        for (const [field, value] of this.hash(key)) flat.push(field, value);
        return flat;
      }
      case "HLEN":
        return this.hash(key).size;
      case "HINCRBY": {
        const hash = this.hash(key);
        const next = (Number(hash.get(args[0])) || 0) + Number(args[1]);
        hash.set(args[0], String(next));
        return next;
      }

      case "SADD": {
        const set = this.set(key);
        let added = 0;
        for (const one of args) if (!set.has(one)) { set.add(one); added += 1; }
        return added;
      }
      case "SREM": {
        const set = this.set(key);
        let gone = 0;
        for (const one of args) if (set.delete(one)) gone += 1;
        return gone;
      }
      case "SISMEMBER":
        return this.set(key).has(args[0]) ? 1 : 0;
      case "SMEMBERS":
        return [...this.set(key)];
      case "SCARD":
        return this.set(key).size;
      case "SPOP": {
        const set = this.set(key);
        const first = [...set][0];
        if (first === undefined) return null;
        set.delete(first);
        return first;
      }

      case "ZADD": {
        const z = this.zset(key);
        for (let i = 0; i + 1 < args.length; i += 2) {
          const score = Number(args[i]);
          const member = args[i + 1];
          const at = z.findIndex((e) => e.member === member);
          if (at >= 0) z[at].score = score;
          else z.push({ score, member });
        }
        z.sort((a, b) => a.score - b.score || a.member.localeCompare(b.member));
        return 1;
      }
      case "ZREM": {
        const z = this.zset(key);
        let gone = 0;
        for (const member of args) {
          const at = z.findIndex((e) => e.member === member);
          if (at >= 0) { z.splice(at, 1); gone += 1; }
        }
        return gone;
      }
      case "ZCARD":
        return this.zset(key).length;
      case "ZSCORE": {
        const found = this.zset(key).find((e) => e.member === args[0]);
        return found ? String(found.score) : null;
      }
      case "ZREMRANGEBYRANK": {
        const z = this.zset(key);
        const [from, to] = [Number(args[0]), Number(args[1])];
        const start = from < 0 ? Math.max(0, z.length + from) : from;
        const end = to < 0 ? z.length + to : to;
        if (end < start) return 0;
        const gone = z.splice(start, end - start + 1);
        return gone.length;
      }
      case "ZREVRANGE": {
        const z = [...this.zset(key)].reverse();
        const [from, to] = [Number(args[0]), Number(args[1])];
        const start = from < 0 ? Math.max(0, z.length + from) : from;
        const end = to < 0 ? z.length + to : to;
        const page = z.slice(start, end + 1);
        if (args.map((a) => a.toUpperCase()).includes("WITHSCORES")) {
          return page.flatMap((e) => [e.member, String(e.score)]);
        }
        return page.map((e) => e.member);
      }

      default:
        throw new Error(`MemoryRedis does not implement ${name}`);
    }
  }

  /** The shape lib/redis.ts exports: one reply per command, in order. */
  pipeline = async (commands: (string | number)[][]): Promise<unknown[]> => commands.map((one) => this.run(one));
}
