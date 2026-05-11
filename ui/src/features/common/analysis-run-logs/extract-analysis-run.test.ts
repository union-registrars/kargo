import { describe, expect, test } from 'vitest';

import { AnalysisRun, JobMetric, Metric } from '@ui/gen/api/stubs/rollouts/v1alpha1/generated_pb';

import { extractFilters } from './extract-analysis-run';

const encoder = new TextEncoder();

const jobMetric = (...containers: string[]): JobMetric =>
  ({
    spec: {
      template: {
        spec: {
          containers: containers.map((name) => ({ name }))
        }
      }
    }
  }) as JobMetric;

const analysisRun = (...metrics: Metric[]): AnalysisRun =>
  ({
    spec: {
      metrics
    }
  }) as AnalysisRun;

const metricWithJobProvider = (name: string, ...containers: string[]): Metric =>
  ({
    name,
    provider: {
      job: jobMetric(...containers),
      plugin: {}
    }
  }) as Metric;

const metricWithPluginProvider = (name: string, plugins: Record<string, Uint8Array>): Metric =>
  ({
    name,
    provider: {
      plugin: plugins
    }
  }) as Metric;

describe('extractFilters', () => {
  test('extracts filters from built-in JobMetric providers', () => {
    const filters = extractFilters(analysisRun(metricWithJobProvider('smoke-test', 'smoke')));

    expect(filters).toEqual({
      jobNames: ['smoke-test'],
      containerNames: {
        'smoke-test': ['smoke']
      }
    });
  });

  test('extracts filters from JobMetric-shaped plugin providers', () => {
    const filters = extractFilters(
      analysisRun(
        metricWithPluginProvider('e2e-tests', {
          'example/job-plugin': encoder.encode(JSON.stringify({ job: jobMetric('e2e') }))
        })
      )
    );

    expect(filters).toEqual({
      jobNames: ['e2e-tests'],
      containerNames: {
        'e2e-tests': ['e2e']
      }
    });
  });

  test('ignores plugin providers without a job config', () => {
    const filters = extractFilters(
      analysisRun(
        metricWithPluginProvider('web-check', {
          'example/web-plugin': encoder.encode(JSON.stringify({ url: 'https://example.com' }))
        })
      )
    );

    expect(filters).toEqual({
      jobNames: [],
      containerNames: {}
    });
  });

  test('ignores plugin providers with invalid JSON configs', () => {
    const filters = extractFilters(
      analysisRun(
        metricWithPluginProvider('bad-plugin', {
          'example/bad-plugin': encoder.encode('{')
        })
      )
    );

    expect(filters).toEqual({
      jobNames: [],
      containerNames: {}
    });
  });

  test('extracts filters from built-in and plugin JobMetric providers together', () => {
    const filters = extractFilters(
      analysisRun(
        metricWithJobProvider('smoke-test', 'smoke'),
        metricWithPluginProvider('e2e-tests', {
          'example/job-plugin': encoder.encode(JSON.stringify({ job: jobMetric('e2e', 'sidecar') }))
        })
      )
    );

    expect(filters).toEqual({
      jobNames: ['smoke-test', 'e2e-tests'],
      containerNames: {
        'smoke-test': ['smoke'],
        'e2e-tests': ['e2e', 'sidecar']
      }
    });
  });
});
