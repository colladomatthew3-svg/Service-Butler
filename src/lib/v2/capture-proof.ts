export type CaptureProofSummary = {
  generatedAt: string;
  tenantId: string;
  isDemo: boolean;
  sourceEventsCaptured: number;
  realSourceEventsCaptured: number;
  opportunitiesCreated: number;
  opportunitiesUpdated: number;
  realOpportunitiesCaptured: number;
  opportunitiesRequiringSdr: number;
  qualifiedContactableOpportunities: number;
  leadsCreated: number;
  realLeadsCreated: number;
  bookedJobsAttributed: number;
  counts: {
    is_simulated: number;
    is_research_only: number;
    counts_as_real_capture: number;
    counts_as_real_lead: number;
  };
};
