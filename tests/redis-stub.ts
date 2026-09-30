import { MemoryRedis } from "@/lib/redis-memory";
export const store = new MemoryRedis();
export const isRedisConfigured = () => true;
export const redisPipeline = (commands: (string | number)[][]) => store.pipeline(commands);
