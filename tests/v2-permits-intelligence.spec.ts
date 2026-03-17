import { expect, test } from "@playwright/test";
import { permitsConnector } from "../src/lib/v2/connectors/permits";

test("permits intelligence normalizes permit categories and demand timing", async () => {
  const events = await permitsConnector.normalize(
    [
      {
        id: "permit-1",
        permit_type: "Roof Repair",
        work_class: "Emergency leak repair",
        description: "Emergency roof leak after storm damage",
        occurred_at: "2026-03-16T09:30:00.000Z",
        address: "120 Broadway, New York, NY",
        postal_code: "10005"
      },
      {
        id: "permit-2",
        permit_type: "HVAC Replacement",
        work_class: "Equipment install",
        description: "Replace aging AC condenser",
        occurred_at: "2026-03-16T08:15:00.000Z",
        address: "50 W 23rd St, New York, NY",
        postal_code: "10010"
      }
    ],
    {
      tenantId: "tenant-1",
      sourceId: "source-permit-1",
      sourceType: "permits",
      config: {
        terms_status: "approved",
        source_name: "Municipal Permits",
        source_provenance: "nyc.permits.api"
      }
    }
  );

  expect(events).toHaveLength(2);

  const roof = events[0]!;
  expect(roof.serviceLineCandidates).toContain("roofing");
  expect(roof.normalizedPayload.permit_category).toBe("roof");
  expect(roof.normalizedPayload.demand_timing).toBe("immediate_service_demand");
  expect(roof.normalizedPayload.work_class).toContain("Emergency");
  expect(roof.likelyJobType).toBe("roof damage inspection");

  const hvac = events[1]!;
  expect(hvac.serviceLineCandidates).toContain("hvac");
  expect(hvac.normalizedPayload.permit_category).toBe("hvac");
  expect(hvac.normalizedPayload.demand_timing).toBe("downstream_upsell");
  expect(typeof hvac.normalizedPayload.connector_version).toBe("string");
});

test("permits intelligence classification maps permit category to service line", async () => {
  const [event] = await permitsConnector.normalize(
    [
      {
        id: "permit-3",
        permit_type: "Plumbing Repair",
        work_class: "Pipe replacement",
        description: "Sewer and drain line repair",
        occurred_at: "2026-03-16T07:00:00.000Z"
      }
    ],
    {
      tenantId: "tenant-1",
      sourceId: "source-permit-2",
      sourceType: "permits",
      config: {
        terms_status: "approved"
      }
    }
  );

  const classification = permitsConnector.classify(event!);
  expect(classification.opportunityType).toBe("plumbing_permit_signal");
  expect(classification.serviceLine).toBe("plumbing");
});
