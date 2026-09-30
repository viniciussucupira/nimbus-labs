import { MemoryRedis } from "@/lib/redis-memory";
export const store = new MemoryRedis();
export const isRedisConfigured = () => true;
export const redisPipeline = (commands: (string | number)[][]) => store.pipeline(commands);
/** Moves the test clock, for a cooldown that has to be outlasted. */
export const advance = (ms: number) => store.advance(ms);
