/**
 * One-off Cursor Admin API probe for validating CURSOR_API_KEY access.
 *
 * Usage:
 *   npx ts-node -P tsconfig.server.json scripts/test-cursor-users.ts
 *   npx ts-node -P tsconfig.server.json scripts/test-cursor-users.ts --limit 25
 *   npx ts-node -P tsconfig.server.json scripts/test-cursor-users.ts --raw
 */

import dotenv from 'dotenv';
import https from 'https';

// Load .env for normal use, but let an explicitly provided process env var win
// when testing a new key without writing it to disk.
dotenv.config();

interface Args {
  limit: number;
  raw: boolean;
}

interface CursorTeamMember {
  id: number;
  email: string;
  name: string;
  role: string;
  isRemoved: boolean;
}

interface CursorTeamMembersResponse {
  teamMembers?: CursorTeamMember[];
}

function parseArgs(argv: string[]): Args {
  const args: Args = { limit: 10, raw: false };

  for (let i = 2; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];

    if (flag === '--raw') {
      args.raw = true;
      continue;
    }

    if (flag === '--limit') {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error('--limit must be a positive integer');
      }
      args.limit = parsed;
      i++;
      continue;
    }

    throw new Error(`Unknown argument: ${flag}`);
  }

  return args;
}

function getApiKey(): string {
  const apiKey = (process.env.CURSOR_API_KEY ?? '').trim();
  if (!apiKey) {
    throw new Error('CURSOR_API_KEY is not set. Add it to .env or export it in your shell.');
  }
  return apiKey;
}

function basicAuthHeader(apiKey: string): string {
  return 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64');
}

function getCursorTeamMembers(): Promise<{ statusCode: number; body: string }> {
  const apiKey = getApiKey();

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.cursor.com',
        path: '/teams/members',
        method: 'GET',
        headers: {
          Authorization: basicAuthHeader(apiKey),
          Accept: 'application/json',
        },
      },
      (res) => {
        let body = '';

        res.on('data', (chunk: Buffer) => {
          body += chunk.toString();
        });

        res.on('end', () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            body,
          });
        });
      },
    );

    req.on('error', reject);
    req.setTimeout(15_000, () => {
      req.destroy(new Error('Cursor Admin API request timed out'));
    });
    req.end();
  });
}

function printMembers(body: string, limit: number): void {
  const parsed = JSON.parse(body) as CursorTeamMembersResponse;
  const members = parsed.teamMembers ?? [];
  const activeMembers = members.filter((member) => !member.isRemoved);

  console.log(`Team members returned: ${members.length}`);
  console.log(`Active members: ${activeMembers.length}`);
  console.log(`Removed members: ${members.length - activeMembers.length}`);

  for (const member of members.slice(0, limit)) {
    const removedSuffix = member.isRemoved ? ' (removed)' : '';
    console.log(`- ${member.name} <${member.email}> [${member.role}]${removedSuffix}`);
  }

  if (members.length > limit) {
    console.log(`... ${members.length - limit} more not shown. Re-run with --limit ${members.length} or --raw.`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  console.log('GET https://api.cursor.com/teams/members');
  const { statusCode, body } = await getCursorTeamMembers();
  console.log(`Status: ${statusCode}`);

  if (statusCode < 200 || statusCode >= 300) {
    console.error('Response body:');
    console.error(body || '<empty>');
    throw new Error('Cursor Admin API request failed');
  }

  if (args.raw) {
    console.log(body);
    return;
  }

  printMembers(body, args.limit);
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
