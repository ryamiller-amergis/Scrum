import {
  dedupePrResolutionMetricRows,
  filterRowsByDateRange,
  isMetricFilename,
  mergeCategoryInto,
  parsePrResolutionMetricsJson,
  isValidMetricRow,
} from '../services/agentEvalsPrResolutionService';
import type { PrResolutionMetricFileRow, PrResolutionMetricsCategoryBucket } from '../types/workitem';

describe('agentEvalsPrResolutionService', () => {
  const sampleRow: PrResolutionMetricFileRow = {
    prId: 6863,
    date: '2026-04-30',
    total: 12,
    accepted: 2,
    wontfix: 10,
    snoozed: 0,
    acceptanceRate: 0.167,
    byCategory: {
      security: { total: 7, accepted: 0, wontfix: 7 },
      bug: { total: 1, accepted: 1, wontfix: 0 },
    },
  };

  describe('isValidMetricRow', () => {
    it('accepts well-formed rows', () => {
      expect(isValidMetricRow(sampleRow)).toBe(true);
    });
    it('rejects objects missing prId or date', () => {
      expect(isValidMetricRow({ date: '2026-01-01' })).toBe(false);
      expect(isValidMetricRow({ prId: 1 })).toBe(false);
      expect(isValidMetricRow(null)).toBe(false);
    });
  });

  describe('parsePrResolutionMetricsJson', () => {
    it('parses array of metrics', () => {
      const rows = parsePrResolutionMetricsJson(JSON.stringify([sampleRow]));
      expect(rows).toHaveLength(1);
      expect(rows[0].prId).toBe(6863);
    });
    it('normalizes legacy timestamp/totalReviewed rows', () => {
      const rows = parsePrResolutionMetricsJson(JSON.stringify([{
        timestamp: '2026-04-29T15:15:00.0000000-04:00',
        prId: 6978,
        totalReviewed: 4,
        accepted: 2,
        wontfix: 2,
        snoozed: 0,
        byCategory: {
          bug: { accepted: 2, wontfix: 1, snoozed: 0 },
          maintainability: { accepted: 0, wontfix: 1, snoozed: 0 },
        },
      }]));
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        prId: 6978,
        date: '2026-04-29',
        timestamp: '2026-04-29T15:15:00.0000000-04:00',
        total: 4,
        acceptanceRate: 0.5,
      });
      expect(rows[0].byCategory?.bug.total).toBe(3);
    });

    it('normalizes reviewedAt/wontFix/rejected variants', () => {
      const rows = parsePrResolutionMetricsJson(JSON.stringify([
        // reviewedAt date, wontfix field, standard byCategory
        { prId: 6780, reviewedAt: '2026-04-17', total: 22, accepted: 4, wontfix: 17, snoozed: 1 },
        // reviewDate, wontFix (capital F)
        { prId: 6874, reviewDate: '2026-04-23', totalThreads: 18, accepted: 13, wontFix: 5, snoozed: 0 },
        // sessionDate, rejected alias
        { prId: 6761, sessionDate: '2026-04-17', totalThreads: 37, accepted: 29, rejected: 8, snoozed: 0, byCategory: { mixed: 37 } },
        // string prId (early format)
        { prId: '6758', date: '2026-04-16', byCategory: { bug: { accepted: 1, rejected: 0, snoozed: 0 }, maintainability: { accepted: 1, rejected: 0, snoozed: 0 } } },
      ]));
      expect(rows).toHaveLength(4);
      expect(rows[0]).toMatchObject({ prId: 6780, date: '2026-04-17', wontfix: 17 });
      expect(rows[1]).toMatchObject({ prId: 6874, date: '2026-04-23', wontfix: 5 });
      expect(rows[2]).toMatchObject({ prId: 6761, date: '2026-04-17', wontfix: 8 });
      // string prId coerced to number; totals computed from byCategory
      expect(rows[3].prId).toBe(6758);
      expect(rows[3].total).toBeGreaterThan(0);
    });
    it('returns empty for invalid JSON', () => {
      expect(parsePrResolutionMetricsJson('not json')).toEqual([]);
    });
    it('returns empty for non-array', () => {
      expect(parsePrResolutionMetricsJson('{}')).toEqual([]);
    });
  });

  describe('dedupePrResolutionMetricRows', () => {
    it('removes exact duplicate snapshots', () => {
      const a: PrResolutionMetricFileRow = { ...sampleRow, total: 12 };
      const b: PrResolutionMetricFileRow = { ...sampleRow, total: 12 };
      const out = dedupePrResolutionMetricRows([a, b]);
      expect(out).toHaveLength(1);
      expect(out[0].total).toBe(12);
    });
    it('keeps distinct timestamped snapshots on the same pr/day', () => {
      const r1 = { ...sampleRow, timestamp: '2026-04-30T10:00:00Z' };
      const r2 = { ...sampleRow, timestamp: '2026-04-30T10:05:00Z' };
      expect(dedupePrResolutionMetricRows([r1, r2])).toHaveLength(2);
    });
    it('keeps distinct dates', () => {
      const r1 = { ...sampleRow, date: '2026-04-30' };
      const r2 = { ...sampleRow, date: '2026-05-01' };
      expect(dedupePrResolutionMetricRows([r1, r2])).toHaveLength(2);
    });
  });

  describe('filterRowsByDateRange', () => {
    const rows: PrResolutionMetricFileRow[] = [
      { ...sampleRow, date: '2026-04-01' },
      { ...sampleRow, prId: 2, date: '2026-04-15' },
      { ...sampleRow, prId: 3, date: '2026-05-20' },
    ];
    it('includes inclusive bounds', () => {
      const f = filterRowsByDateRange(rows, '2026-04-01', '2026-04-15');
      expect(f.map((r) => r.prId).sort()).toEqual([2, 6863]);
    });
    it('defaults to wide open range when params missing', () => {
      expect(filterRowsByDateRange(rows, undefined, undefined)).toHaveLength(3);
    });
  });

  describe('mergeCategoryInto', () => {
    it('merges category buckets', () => {
      const target: Record<string, PrResolutionMetricsCategoryBucket> = {};
      mergeCategoryInto(target, sampleRow.byCategory);
      expect(target.security).toEqual({ total: 7, accepted: 0, wontfix: 7, snoozed: 0 });
      mergeCategoryInto(target, { security: { total: 1, accepted: 1, wontfix: 0 } });
      expect(target.security).toEqual({ total: 8, accepted: 1, wontfix: 7, snoozed: 0 });
    });
  });

  describe('isMetricFilename', () => {
    const yes = (name: string) => expect(isMetricFilename(name)).toBe(true);
    const no  = (name: string) => expect(isMetricFilename(name)).toBe(false);

    it('accepts canonical and variant pr-resolution filenames', () => {
      yes('pr-resolution-metrics.json');
      yes('pr-resolution-2026-04-29.json');
      yes('pr-resolution-run2.json');
      yes('pr-resolution-6863.json');
      yes('pr-resolution-metrics-run2.json');
    });

    it('accepts legacy pre-resolution typo variants', () => {
      yes('pre-resolution-metrics.json');
      yes('pre-resolution-2026-04-29.json');
      yes('pre-resolution-run2.json');
    });

    it('accepts pr-review with numeric prId and YYYY-MM-DD date', () => {
      yes('pr-review-6863-2026-04-29.json');
    });

    it('rejects unrelated filenames', () => {
      no('some-other-file.json');
      no('resolution-metrics.json');          // missing pr/pre prefix
      no('preflight-resolution-metrics.json'); // unrelated prefix
    });

    it('rejects wrong extension or backup files', () => {
      no('pr-resolution.txt');
      no('pr-resolution.json.bak');
    });

    it('rejects pr-review with non-numeric prId', () => {
      no('pr-review-abc-2026-04-29.json');
    });

    it('rejects pr-review without a valid date suffix', () => {
      no('pr-review-6863-run2.json');
    });
  });
});
