/**
 * Server-only Cursor Admin + Analytics API client.
 *
 * Authentication: HTTP Basic Auth — API key as username, empty password.
 * Uses CURSOR_TEAM_API_KEY (team admin key) for all metrics/analytics calls
 * to api.cursor.com. CURSOR_API_KEY is reserved for the SDK chat agent.
 *
 * Rate limits (from Cursor docs):
 *   - Admin endpoints: 20 req/min per team
 *   - Analytics endpoints: 100 req/min for most team-level endpoints
 *
 * Date window constraint: /teams/daily-usage-data allows max 30 days per
 * request. This service automatically chunks longer ranges.
 */

import https from 'https';
import type {
  CursorTeamMembersResponse,
  CursorDailyUsageResponse,
  CursorDailyUsageRow,
  CursorDauResponse,
  CursorAgentEditsResponse,
  CursorTabsResponse,
  CursorSkillsResponse,
  CursorMcpResponse,
  CursorCommandsResponse,
  CursorPlansResponse,
  CursorLeaderboardResponse,
  CursorTeamSummary,
  CursorDeveloperSummary,
} from '../types/cursorAnalytics';

const CURSOR_BASE_HOST = 'api.cursor.com';
const MAX_DAYS_PER_CHUNK = 30;

function getApiKey(): string {
  const key = process.env.CURSOR_TEAM_API_KEY ?? process.env.CURSOR_API_KEY ?? '';
  if (!key) throw new Error('CURSOR_TEAM_API_KEY is not configured');
  return key;
}

function basicAuthHeader(apiKey: string): string {
  return 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64');
}

/** Generic HTTPS GET against api.cursor.com */
function cursorGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const apiKey = getApiKey();
  const query = params && Object.keys(params).length
    ? '?' + new URLSearchParams(params).toString()
    : '';
  const fullPath = path + query;

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: CURSOR_BASE_HOST,
        path: fullPath,
        method: 'GET',
        headers: {
          Authorization: basicAuthHeader(apiKey),
          Accept: 'application/json',
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(body) as T); }
            catch { reject(new Error(`Cursor API JSON parse error for ${path}`)); }
          } else {
            reject(new Error(`Cursor API ${res.statusCode} for ${path}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(15_000, () => { req.destroy(); reject(new Error(`Cursor API timeout: ${path}`)); });
    req.end();
  });
}

/** Generic HTTPS POST against api.cursor.com with a JSON body */
function cursorPost<T>(path: string, body: unknown): Promise<T> {
  const apiKey = getApiKey();
  const payload = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: CURSOR_BASE_HOST,
        path,
        method: 'POST',
        headers: {
          Authorization: basicAuthHeader(apiKey),
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          Accept: 'application/json',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(data) as T); }
            catch { reject(new Error(`Cursor API JSON parse error for ${path}`)); }
          } else {
            reject(new Error(`Cursor API ${res.statusCode} for ${path}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(15_000, () => { req.destroy(); reject(new Error(`Cursor API timeout: ${path}`)); });
    req.write(payload);
    req.end();
  });
}

// ── Public API methods ─────────────────────────────────────────────────────────

export async function getCursorTeamMembers(): Promise<CursorTeamMembersResponse> {
  return cursorGet<CursorTeamMembersResponse>('/teams/members');
}

/**
 * Fetches per-user daily usage data for a date range, with automatic
 * 30-day chunking and full-team pagination.
 */
export async function getCursorDailyUsageData(
  fromDate: Date,
  toDate: Date,
): Promise<CursorDailyUsageRow[]> {
  const rows: CursorDailyUsageRow[] = [];
  const PAGE_SIZE = 100;

  // Chunk into <=30-day windows
  const chunks: Array<{ start: Date; end: Date }> = [];
  let cursor = new Date(fromDate);
  while (cursor < toDate) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setDate(chunkEnd.getDate() + MAX_DAYS_PER_CHUNK - 1);
    chunks.push({ start: new Date(cursor), end: chunkEnd > toDate ? new Date(toDate) : chunkEnd });
    cursor.setDate(cursor.getDate() + MAX_DAYS_PER_CHUNK);
  }

  for (const { start, end } of chunks) {
    // Paginate through all team members
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const res = await cursorPost<CursorDailyUsageResponse>('/teams/daily-usage-data', {
        startDate: start.getTime(),
        endDate: end.getTime(),
        page,
        pageSize: PAGE_SIZE,
      });
      rows.push(...(res.data ?? []));
      hasMore = res.pagination?.hasNextPage ?? false;
      page++;
    }
  }

  return rows;
}

export async function getCursorDau(fromStr: string, toStr: string): Promise<CursorDauResponse> {
  return cursorGet<CursorDauResponse>('/analytics/team/dau', {
    startDate: fromStr,
    endDate: toStr,
  });
}

export async function getCursorAgentEdits(fromStr: string, toStr: string): Promise<CursorAgentEditsResponse> {
  return cursorGet<CursorAgentEditsResponse>('/analytics/team/agent-edits', {
    startDate: fromStr,
    endDate: toStr,
  });
}

export async function getCursorTabs(fromStr: string, toStr: string): Promise<CursorTabsResponse> {
  return cursorGet<CursorTabsResponse>('/analytics/team/tabs', {
    startDate: fromStr,
    endDate: toStr,
  });
}

export async function getCursorSkills(fromStr: string, toStr: string): Promise<CursorSkillsResponse> {
  return cursorGet<CursorSkillsResponse>('/analytics/team/skills', {
    startDate: fromStr,
    endDate: toStr,
  });
}

export async function getCursorMcp(fromStr: string, toStr: string): Promise<CursorMcpResponse> {
  return cursorGet<CursorMcpResponse>('/analytics/team/mcp', {
    startDate: fromStr,
    endDate: toStr,
  });
}

export async function getCursorCommands(fromStr: string, toStr: string): Promise<CursorCommandsResponse> {
  return cursorGet<CursorCommandsResponse>('/analytics/team/commands', {
    startDate: fromStr,
    endDate: toStr,
  });
}

export async function getCursorPlans(fromStr: string, toStr: string): Promise<CursorPlansResponse> {
  return cursorGet<CursorPlansResponse>('/analytics/team/plans', {
    startDate: fromStr,
    endDate: toStr,
  });
}

export async function getCursorLeaderboard(): Promise<CursorLeaderboardResponse> {
  return cursorGet<CursorLeaderboardResponse>('/analytics/team/leaderboard');
}

// ── Aggregation helpers ────────────────────────────────────────────────────────

/**
 * Counts the number of ISO weeks (Mon–Sun) within a date range that have at
 * least one entry where the predicate is true.
 */
function countWeeksWithCondition(
  dates: string[],
  predicate: (date: string) => boolean,
): number {
  const weekSet = new Set<string>();
  for (const d of dates) {
    if (predicate(d)) {
      const dt = new Date(d);
      const dow = dt.getDay(); // 0=Sun
      const diff = dow === 0 ? -6 : 1 - dow;
      const mon = new Date(dt);
      mon.setDate(dt.getDate() + diff);
      weekSet.add(mon.toISOString().split('T')[0]!);
    }
  }
  return weekSet.size;
}

/** Returns the number of consecutive weeks (ending from the most recent week) that all satisfy the predicate. */
function countConsecutiveWeeksFromEnd(
  weekDauMap: Map<string, number>,
  teamSize: number,
  pct: number,
): number {
  const sortedWeeks = Array.from(weekDauMap.keys()).sort().reverse();
  let count = 0;
  for (const week of sortedWeeks) {
    const avgDau = weekDauMap.get(week)!;
    if (avgDau / teamSize >= pct) count++;
    else break;
  }
  return count;
}

/**
 * Given daily usage rows and team members, builds the per-developer
 * and team-level Cursor usage summary used by the scoring service.
 */
export async function buildCursorTeamSummary(
  fromDate: Date,
  toDate: Date,
): Promise<CursorTeamSummary> {
  const windowDays = Math.max(
    1,
    Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const fromStr = fromDate.toISOString().split('T')[0]!;
  const toStr = toDate.toISOString().split('T')[0]!;

  // Fetch all data in parallel where possible
  const [membersRes, usageRows, dauRes, agentEditsRes, tabsRes, skillsRes, mcpRes, commandsRes, plansRes] =
    await Promise.allSettled([
      getCursorTeamMembers(),
      getCursorDailyUsageData(fromDate, toDate),
      getCursorDau(fromStr, toStr),
      getCursorAgentEdits(fromStr, toStr),
      getCursorTabs(fromStr, toStr),
      getCursorSkills(fromStr, toStr),
      getCursorMcp(fromStr, toStr),
      getCursorCommands(fromStr, toStr),
      getCursorPlans(fromStr, toStr),
    ]);

  const members = membersRes.status === 'fulfilled'
    ? membersRes.value.teamMembers.filter(m => !m.isRemoved)
    : [];
  const rows: CursorDailyUsageRow[] = usageRows.status === 'fulfilled' ? usageRows.value : [];
  const dauSeries = dauRes.status === 'fulfilled' ? dauRes.value.data : [];
  const agentEditsData = agentEditsRes.status === 'fulfilled' ? agentEditsRes.value.data : [];
  const tabsData = tabsRes.status === 'fulfilled' ? tabsRes.value.data : [];
  const skillsData = skillsRes.status === 'fulfilled' ? skillsRes.value.data : [];
  const mcpData = mcpRes.status === 'fulfilled' ? mcpRes.value.data : [];
  const commandsData = commandsRes.status === 'fulfilled' ? commandsRes.value.data : [];
  const plansData = plansRes.status === 'fulfilled' ? plansRes.value.data : [];

  const teamSize = members.length;

  // Per-developer aggregation from daily-usage-data rows
  const devMap = new Map<string, {
    userId: number; name: string; role: string;
    activeDays: Set<string>;
    acceptedLinesAdded: number; totalApplies: number;
    totalAccepts: number; cmdkUsages: number; bugbotUsages: number;
  }>();

  // Seed from members so inactive members still appear
  for (const m of members) {
    devMap.set(m.email, {
      userId: m.id, name: m.name, role: m.role,
      activeDays: new Set(),
      acceptedLinesAdded: 0, totalApplies: 0,
      totalAccepts: 0, cmdkUsages: 0, bugbotUsages: 0,
    });
  }

  for (const row of rows) {
    if (!row.email) continue;
    if (!devMap.has(row.email)) {
      devMap.set(row.email, {
        userId: row.userId, name: row.email, role: 'member',
        activeDays: new Set(),
        acceptedLinesAdded: 0, totalApplies: 0,
        totalAccepts: 0, cmdkUsages: 0, bugbotUsages: 0,
      });
    }
    const dev = devMap.get(row.email)!;
    const isActive = row.isActive !== undefined
      ? row.isActive
      : (row.totalAccepts > 0 || row.totalApplies > 0 || row.cmdkUsages > 0);
    if (isActive) dev.activeDays.add(row.day);
    dev.acceptedLinesAdded += row.acceptedLinesAdded ?? 0;
    dev.totalApplies += row.totalApplies ?? 0;
    dev.totalAccepts += row.totalAccepts ?? 0;
    dev.cmdkUsages += row.cmdkUsages ?? 0;
    dev.bugbotUsages += row.bugbotUsages ?? 0;
  }

  // Build CursorDeveloperSummary entries
  const developers: CursorDeveloperSummary[] = [];
  for (const [email, d] of devMap.entries()) {
    const activeDays = d.activeDays.size;
    const sustainedWeeks = countWeeksWithCondition(
      Array.from(d.activeDays),
      () => true,
    );
    developers.push({
      email,
      name: d.name,
      cursorId: d.userId,
      role: d.role,
      activeDays,
      windowDays,
      dauFraction: windowDays > 0 ? activeDays / windowDays : 0,
      sustainedWeeks,
      totalAcceptedLines: d.acceptedLinesAdded,
      totalApplies: d.totalApplies,
      totalAccepts: d.totalAccepts,
      cmdkUsages: d.cmdkUsages,
      bugbotUsages: d.bugbotUsages,
    });
  }

  // Team-level DAU thresholds
  const daysAbove50pct = dauSeries.filter(r => teamSize > 0 && r.dau / teamSize >= 0.5).length;
  const daysAbove80pct = dauSeries.filter(r => teamSize > 0 && r.dau / teamSize >= 0.8).length;

  // Build weekly average DAU map
  const weekDauSum = new Map<string, { sum: number; count: number }>();
  for (const r of dauSeries) {
    const dt = new Date(r.date);
    const dow = dt.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    const mon = new Date(dt);
    mon.setDate(dt.getDate() + diff);
    const key = mon.toISOString().split('T')[0]!;
    const prev = weekDauSum.get(key) ?? { sum: 0, count: 0 };
    weekDauSum.set(key, { sum: prev.sum + r.dau, count: prev.count + 1 });
  }
  const weekAvgDauMap = new Map<string, number>();
  for (const [week, { sum, count }] of weekDauSum.entries()) {
    weekAvgDauMap.set(week, count > 0 ? sum / count : 0);
  }
  const weeksAbove50pct = countConsecutiveWeeksFromEnd(weekAvgDauMap, teamSize, 0.5);
  const weeksAbove80pct = countConsecutiveWeeksFromEnd(weekAvgDauMap, teamSize, 0.8);

  // Tab acceptance rate
  const totalTabSuggestions = tabsData.reduce((s, r) => s + r.total_suggestions, 0);
  const totalTabAccepts = tabsData.reduce((s, r) => s + r.total_accepts, 0);
  const tabAcceptRate = totalTabSuggestions > 0 ? totalTabAccepts / totalTabSuggestions : 0;

  // Agent edit acceptance rate
  const totalAgentSuggestions = agentEditsData.reduce((s, r) => s + r.total_suggested_diffs, 0);
  const totalAgentAccepts = agentEditsData.reduce((s, r) => s + r.total_accepted_diffs, 0);
  const agentEditAcceptRate = totalAgentSuggestions > 0 ? totalAgentAccepts / totalAgentSuggestions : 0;

  // Skills in use
  const skillSet = new Set<string>();
  let totalSkillUsages = 0;
  for (const r of skillsData) {
    if (r.skill_name) { skillSet.add(r.skill_name); totalSkillUsages += r.usage; }
  }

  // MCP tools in use
  const mcpSet = new Set<string>();
  for (const r of mcpData) { if (r.tool_name) mcpSet.add(r.tool_name); }

  // Plan mode usages
  const planModeUsages = plansData.reduce((s, r) => s + r.usage, 0);

  // Commands used
  const commandSet = new Set<string>();
  for (const r of commandsData) { if (r.command_name) commandSet.add(r.command_name); }

  return {
    teamSize,
    activeSeats: members.length,
    developers,
    dauSeries,
    daysAbove50pct,
    daysAbove80pct,
    weeksAbove50pct,
    weeksAbove80pct,
    tabAcceptRate,
    agentEditAcceptRate,
    skillsInUse: Array.from(skillSet),
    totalSkillUsages,
    mcpToolsInUse: Array.from(mcpSet),
    planModeUsages,
    commandsUsed: Array.from(commandSet),
  };
}
