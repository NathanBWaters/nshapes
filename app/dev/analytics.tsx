import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import AnalyticsDashboard, { type DashboardSource } from '@/analytics/components/AnalyticsDashboard';

const parseSource = (raw: string | string[] | undefined): DashboardSource => {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === 'simulated' || value === 'import' || value === 'local') {
    return value;
  }
  return 'local';
};

export default function DevAnalyticsRoute() {
  const params = useLocalSearchParams<{ source?: string | string[] }>();
  const initialSource = parseSource(params.source);

  return (
    <AnalyticsDashboard
      initialSource={initialSource}
      onBack={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/');
        }
      }}
    />
  );
}
