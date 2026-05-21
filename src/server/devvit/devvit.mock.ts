// import { RedisMemoryServer } from 'redis-memory-server';
import { Redis } from 'ioredis';

// let redisServer: RedisMemoryServer;

// const initializeRedis = async () => {
//   redisServer = new RedisMemoryServer();
//   const host = await redisServer.getHost();
//   const port = await redisServer.getPort();
// };

const redis = new Redis();

// initializeRedis().catch(console.error);

const reddit = {};

const context = {};

const createServer = (server: any) => server;

function getServerPort() {
  return 3000;
}

console.log('using devvit mocks');

export { createServer, context, getServerPort, reddit, redis };
