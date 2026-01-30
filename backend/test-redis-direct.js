import { createClient } from 'redis';

// SECURITY: Never hardcode credentials! Use environment variables.
const url = process.env.REDIS_URL;

if (!url) {
  console.error('❌ REDIS_URL not set in environment');
  process.exit(1);
}

console.log('Testing:', url.replace(/:[^:@]+@/, ':***@')); // Redact password in logs

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
