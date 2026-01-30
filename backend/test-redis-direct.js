import { createClient } from 'redis';

const url = process.env.REDIS_URL || 'rediss://default:Aap9AAIncDJmYWE1OTFhOTIwNDM0MGEwOTU1NWIwNDYwNGRkZWI1OHAyNDM2NDU@vital-jennet-43645.upstash.io:6379';

console.log('Testing:', url);

const client = createClient({ url });

client.on('error', err => console.error('Redis Error:', err));

try {
  await client.connect();
  console.log('✅ Connected');
  const pong = await client.ping();
  console.log('✅ PING:', pong);
  await client.quit();
} catch (err) {
  console.error('❌ Failed:', err.message);
  console.error('Stack:', err.stack);
}
