import { AnalysisRun, JobMetric, Metric } from '@ui/gen/api/stubs/rollouts/v1alpha1/generated_pb';

const getJobMetric = (metric: Metric): JobMetric | undefined => {
  if (metric?.provider?.job) {
    return metric.provider.job;
  }

  for (const pluginConfig of Object.values(metric?.provider?.plugin || {})) {
    try {
      const config = JSON.parse(new TextDecoder().decode(pluginConfig)) as { job?: JobMetric };
      if (config?.job) {
        return config.job;
      }
    } catch {
      // Ignore plugin configs that are not JSON job providers.
    }
  }
};

export const extractFilters = (ar: AnalysisRun) => {
  const jobMetrics =
    ar?.spec?.metrics
      ?.map((metric) => ({ metric, job: getJobMetric(metric) }))
      .filter((metric): metric is { metric: Metric; job: JobMetric } => !!metric.job) || [];

  const containerNames: Record<string, string[]> = {};

  for (const { metric, job } of jobMetrics) {
    const containers = job?.spec?.template?.spec?.containers;

    for (const container of containers || []) {
      if (!containerNames[metric?.name]) {
        containerNames[metric?.name] = [];
      }

      containerNames[metric?.name].push(container?.name);
    }
  }

  return {
    jobNames: jobMetrics.map(({ metric }) => metric?.name) || [],
    containerNames
  };
};
