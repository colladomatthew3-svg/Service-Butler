"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutboundView = OutboundView;
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const page_header_1 = require("@/components/ui/page-header");
const card_1 = require("@/components/ui/card");
const button_1 = require("@/components/ui/button");
const badge_1 = require("@/components/ui/badge");
const input_1 = require("@/components/ui/input");
const select_1 = require("@/components/ui/select");
const table_1 = require("@/components/ui/table");
const toast_1 = require("@/components/ui/toast");
const segmentOptions = [
    "property_manager",
    "multifamily_operator",
    "commercial_owner",
    "hoa",
    "facilities_manager",
    "insurance_agent",
    "public_adjuster",
    "plumber",
    "roofer",
    "hvac_contractor",
    "broker_agent",
    "inspector"
];
function segmentLabel(value) {
    return value
        .split(/[_-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}
function OutboundView() {
    const [prospects, setProspects] = (0, react_1.useState)([]);
    const [referralPartners, setReferralPartners] = (0, react_1.useState)([]);
    const [outboundLists, setOutboundLists] = (0, react_1.useState)([]);
    const [opportunities, setOpportunities] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [submitting, setSubmitting] = (0, react_1.useState)(false);
    const [syncingId, setSyncingId] = (0, react_1.useState)(null);
    const [triggeringId, setTriggeringId] = (0, react_1.useState)(null);
    const csvInputRef = (0, react_1.useRef)(null);
    const { showToast } = (0, toast_1.useToast)();
    const [prospectForm, setProspectForm] = (0, react_1.useState)({
        company_name: "",
        contact_name: "",
        email: "",
        phone: "",
        city: "",
        state: "NY",
        territory: "",
        prospect_type: "property_manager"
    });
    const [partnerForm, setPartnerForm] = (0, react_1.useState)({
        company_name: "",
        contact_name: "",
        email: "",
        phone: "",
        city: "",
        state: "NY",
        territory: "",
        partner_type: "insurance_agent"
    });
    const [listForm, setListForm] = (0, react_1.useState)({
        name: "",
        listType: "prospect",
        territory: "",
        segmentType: "property_manager",
        campaignName: "",
        smartleadCampaignId: "",
        nearIncident: "all"
    });
    const loadAll = (0, react_1.useCallback)(async () => {
        setLoading(true);
        const [prospectsRes, partnersRes, listsRes, opportunitiesRes] = await Promise.all([
            fetch("/api/prospects"),
            fetch("/api/referral-partners"),
            fetch("/api/outbound-lists"),
            fetch("/api/opportunities?limit=8")
        ]);
        const [prospectsData, partnersData, listsData, opportunitiesData] = await Promise.all([
            prospectsRes.json().catch(() => ({})),
            partnersRes.json().catch(() => ({})),
            listsRes.json().catch(() => ({})),
            opportunitiesRes.json().catch(() => ({}))
        ]);
        if (!prospectsRes.ok || !partnersRes.ok || !listsRes.ok || !opportunitiesRes.ok) {
            showToast("Could not load outbound workspace");
            setLoading(false);
            return;
        }
        setProspects(prospectsData.prospects || []);
        setReferralPartners(partnersData.referralPartners || []);
        setOutboundLists(listsData.outboundLists || []);
        setOpportunities(opportunitiesData.opportunities || []);
        setLoading(false);
    }, [showToast]);
    (0, react_1.useEffect)(() => {
        loadAll();
    }, [loadAll]);
    const stats = (0, react_1.useMemo)(() => ({
        prospects: prospects.length,
        referralPartners: referralPartners.length,
        outboundLists: outboundLists.length,
        triggered: outboundLists.filter((item) => item.list_type === "incident_triggered").length
    }), [prospects, referralPartners, outboundLists]);
    async function createProspect() {
        setSubmitting(true);
        const res = await fetch("/api/prospects", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(prospectForm)
        });
        const data = await res.json().catch(() => ({}));
        setSubmitting(false);
        if (!res.ok) {
            showToast(data.error || "Could not add prospect");
            return;
        }
        setProspectForm({
            company_name: "",
            contact_name: "",
            email: "",
            phone: "",
            city: "",
            state: "NY",
            territory: "",
            prospect_type: "property_manager"
        });
        showToast("Prospect added");
        loadAll();
    }
    async function createPartner() {
        setSubmitting(true);
        const res = await fetch("/api/referral-partners", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(partnerForm)
        });
        const data = await res.json().catch(() => ({}));
        setSubmitting(false);
        if (!res.ok) {
            showToast(data.error || "Could not add referral partner");
            return;
        }
        setPartnerForm({
            company_name: "",
            contact_name: "",
            email: "",
            phone: "",
            city: "",
            state: "NY",
            territory: "",
            partner_type: "insurance_agent"
        });
        showToast("Referral partner added");
        loadAll();
    }
    async function createList() {
        setSubmitting(true);
        const res = await fetch("/api/outbound-lists", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                name: listForm.name || `${segmentLabel(listForm.segmentType)} - ${listForm.territory || "territory"} outreach`,
                listType: listForm.listType,
                territory: listForm.territory || null,
                campaignName: listForm.campaignName || null,
                smartleadCampaignId: listForm.smartleadCampaignId || null,
                segmentTypes: [listForm.segmentType],
                nearIncident: listForm.nearIncident === "all" ? null : listForm.nearIncident === "yes"
            })
        });
        const data = await res.json().catch(() => ({}));
        setSubmitting(false);
        if (!res.ok) {
            showToast(data.error || "Could not create outbound list");
            return;
        }
        showToast("Outbound list created");
        loadAll();
    }
    async function createTriggeredList(opportunityId) {
        setTriggeringId(opportunityId);
        const res = await fetch(`/api/opportunities/${opportunityId}/outbound-list`, { method: "POST" });
        const data = await res.json().catch(() => ({}));
        setTriggeringId(null);
        if (!res.ok) {
            showToast(data.error || "Could not generate incident-triggered list");
            return;
        }
        showToast("Incident-triggered list created");
        loadAll();
    }
    async function syncList(listId, campaignId) {
        setSyncingId(listId);
        const res = await fetch(`/api/outbound-lists/${listId}/sync`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ smartleadCampaignId: campaignId || null })
        });
        const data = await res.json().catch(() => ({}));
        setSyncingId(null);
        if (!res.ok) {
            showToast(data.error || "Smartlead sync failed");
            return;
        }
        showToast(data.fallback ? "Smartlead not configured; CSV fallback is ready." : "List pushed to Smartlead");
        loadAll();
    }
    function exportList(listId) {
        window.location.href = `/api/outbound-lists/${listId}/export`;
    }
    async function handleCsvUpload(file) {
        const text = await file.text();
        const rows = parseCsv(text);
        if (rows.length === 0) {
            showToast("No valid rows in CSV");
            return;
        }
        const res = await fetch("/api/outbound/import", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ rows })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            showToast(data.error || "Import failed");
            return;
        }
        showToast(`Imported ${rows.length} prospect rows`);
        loadAll();
    }
    return (<div className="space-y-6">
      <page_header_1.PageHeader title="Outbound Engine" subtitle="Build target lists by territory, work referral relationships, and push incident-triggered outreach into Smartlead." actions={<div className="flex flex-wrap gap-2">
            <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => {
                const file = event.target.files?.[0];
                if (file)
                    handleCsvUpload(file);
            }}/>
            <button_1.Button size="lg" variant="secondary" onClick={() => csvInputRef.current?.click()}>
              <lucide_react_1.Upload className="h-4 w-4"/>
              Import CSV
            </button_1.Button>
            <button_1.Button size="lg" variant="secondary" onClick={() => loadAll()}>
              <lucide_react_1.RefreshCw className="h-4 w-4"/>
              Refresh
            </button_1.Button>
          </div>}/>

      <section className="grid gap-4 lg:grid-cols-4">
        <StatCard label="Prospects" value={String(stats.prospects)} helper="Property managers, owners, facilities" icon={lucide_react_1.Users}/>
        <StatCard label="Referral Partners" value={String(stats.referralPartners)} helper="Plumbers, adjusters, roofers" icon={lucide_react_1.Building2}/>
        <StatCard label="Outbound Lists" value={String(stats.outboundLists)} helper="Ready for Smartlead or CSV" icon={lucide_react_1.Megaphone}/>
        <StatCard label="Incident Triggered" value={String(stats.triggered)} helper="Generated from live opportunities" icon={lucide_react_1.Siren}/>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <card_1.Card>
          <card_1.CardHeader>
            <h2 className="dashboard-section-title text-semantic-text">Recent Opportunities To Work</h2>
          </card_1.CardHeader>
          <card_1.CardBody className="space-y-3">
            {loading ? (<p className="text-sm text-semantic-muted">Loading opportunities...</p>) : opportunities.length === 0 ? (<p className="text-sm text-semantic-muted">Run the scanner to create incident-driven outbound opportunities.</p>) : (opportunities.map((item) => (<div key={item.id} className="rounded-xl border border-semantic-border/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">{item.category || "opportunity"}</p>
                      <h3 className="mt-1 text-base font-semibold text-semantic-text">{item.title || "Opportunity"}</h3>
                      <p className="mt-1 text-sm text-semantic-muted">
                        {item.location_text || [item.city, item.state].filter(Boolean).join(", ") || item.territory || "Service area"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <badge_1.Badge variant="default">Confidence {item.confidence || 0}</badge_1.Badge>
                      <badge_1.Badge variant={(item.urgency_score || 0) >= 70 ? "warning" : "default"}>Urgency {item.urgency_score || 0}</badge_1.Badge>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button_1.Button size="sm" onClick={() => createTriggeredList(item.id)} disabled={triggeringId === item.id}>
                      <lucide_react_1.Plus className="h-4 w-4"/>
                      {triggeringId === item.id ? "Generating..." : "Generate Triggered List"}
                    </button_1.Button>
                    <badge_1.Badge variant="default">
                      {String(item.raw?.source || item.raw?.signal_source || "scanner")}
                    </badge_1.Badge>
                  </div>
                </div>)))}
          </card_1.CardBody>
        </card_1.Card>

        <card_1.Card>
          <card_1.CardHeader>
            <h2 className="dashboard-section-title text-semantic-text">Build New Outbound List</h2>
          </card_1.CardHeader>
          <card_1.CardBody className="space-y-3">
            <input_1.Input placeholder="List name" value={listForm.name} onChange={(event) => setListForm((prev) => ({ ...prev, name: event.target.value }))}/>
            <div className="grid gap-3 sm:grid-cols-2">
              <select_1.Select value={listForm.listType} onChange={(event) => setListForm((prev) => ({ ...prev, listType: event.target.value }))}>
                <option value="prospect">Prospect List</option>
                <option value="referral_partner">Referral Partner List</option>
                <option value="incident_triggered">Incident Triggered</option>
              </select_1.Select>
              <select_1.Select value={listForm.segmentType} onChange={(event) => setListForm((prev) => ({ ...prev, segmentType: event.target.value }))}>
                {segmentOptions.map((segment) => (<option key={segment} value={segment}>{segmentLabel(segment)}</option>))}
              </select_1.Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input_1.Input placeholder="Territory (e.g. Nassau County, NY)" value={listForm.territory} onChange={(event) => setListForm((prev) => ({ ...prev, territory: event.target.value }))}/>
              <select_1.Select value={listForm.nearIncident} onChange={(event) => setListForm((prev) => ({ ...prev, nearIncident: event.target.value }))}>
                <option value="all">All records</option>
                <option value="yes">Near active incident only</option>
                <option value="no">Exclude incident-linked</option>
              </select_1.Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input_1.Input placeholder="Smartlead campaign name" value={listForm.campaignName} onChange={(event) => setListForm((prev) => ({ ...prev, campaignName: event.target.value }))}/>
              <input_1.Input placeholder="Smartlead campaign ID (optional)" value={listForm.smartleadCampaignId} onChange={(event) => setListForm((prev) => ({ ...prev, smartleadCampaignId: event.target.value }))}/>
            </div>
            <button_1.Button onClick={createList} disabled={submitting}>
              <lucide_react_1.Plus className="h-4 w-4"/>
              Create Outbound List
            </button_1.Button>
          </card_1.CardBody>
        </card_1.Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <card_1.Card>
          <card_1.CardHeader>
            <h2 className="dashboard-section-title text-semantic-text">Prospects</h2>
          </card_1.CardHeader>
          <card_1.CardBody className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <input_1.Input placeholder="Company name" value={prospectForm.company_name} onChange={(event) => setProspectForm((prev) => ({ ...prev, company_name: event.target.value }))}/>
              <input_1.Input placeholder="Contact name" value={prospectForm.contact_name} onChange={(event) => setProspectForm((prev) => ({ ...prev, contact_name: event.target.value }))}/>
              <input_1.Input placeholder="Email" value={prospectForm.email} onChange={(event) => setProspectForm((prev) => ({ ...prev, email: event.target.value }))}/>
              <input_1.Input placeholder="Phone" value={prospectForm.phone} onChange={(event) => setProspectForm((prev) => ({ ...prev, phone: event.target.value }))}/>
              <input_1.Input placeholder="City" value={prospectForm.city} onChange={(event) => setProspectForm((prev) => ({ ...prev, city: event.target.value }))}/>
              <input_1.Input placeholder="Territory" value={prospectForm.territory} onChange={(event) => setProspectForm((prev) => ({ ...prev, territory: event.target.value }))}/>
              <select_1.Select value={prospectForm.prospect_type} onChange={(event) => setProspectForm((prev) => ({ ...prev, prospect_type: event.target.value }))}>
                {segmentOptions.map((segment) => (<option key={segment} value={segment}>{segmentLabel(segment)}</option>))}
              </select_1.Select>
              <button_1.Button onClick={createProspect} disabled={submitting}>
                <lucide_react_1.Plus className="h-4 w-4"/>
                Add Prospect
              </button_1.Button>
            </div>

            <div className="overflow-x-auto">
              <table_1.Table>
                <table_1.TableHead>
                  <tr>
                    <table_1.TH>Company</table_1.TH>
                    <table_1.TH>Segment</table_1.TH>
                    <table_1.TH>Territory</table_1.TH>
                    <table_1.TH>Contact</table_1.TH>
                  </tr>
                </table_1.TableHead>
                <table_1.TableBody>
                  {prospects.slice(0, 8).map((row) => (<tr key={row.id}>
                      <table_1.TD>
                        <div>
                          <p className="font-medium">{row.company_name}</p>
                          <p className="text-xs text-semantic-muted">{row.source || "manual"}</p>
                        </div>
                      </table_1.TD>
                      <table_1.TD>{segmentLabel(row.prospect_type)}</table_1.TD>
                      <table_1.TD>{row.territory || [row.city, row.state].filter(Boolean).join(", ") || "-"}</table_1.TD>
                      <table_1.TD>{row.contact_name || row.email || row.phone || "-"}</table_1.TD>
                    </tr>))}
                </table_1.TableBody>
              </table_1.Table>
            </div>
          </card_1.CardBody>
        </card_1.Card>

        <card_1.Card>
          <card_1.CardHeader>
            <h2 className="dashboard-section-title text-semantic-text">Referral Partners</h2>
          </card_1.CardHeader>
          <card_1.CardBody className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <input_1.Input placeholder="Company name" value={partnerForm.company_name} onChange={(event) => setPartnerForm((prev) => ({ ...prev, company_name: event.target.value }))}/>
              <input_1.Input placeholder="Contact name" value={partnerForm.contact_name} onChange={(event) => setPartnerForm((prev) => ({ ...prev, contact_name: event.target.value }))}/>
              <input_1.Input placeholder="Email" value={partnerForm.email} onChange={(event) => setPartnerForm((prev) => ({ ...prev, email: event.target.value }))}/>
              <input_1.Input placeholder="Phone" value={partnerForm.phone} onChange={(event) => setPartnerForm((prev) => ({ ...prev, phone: event.target.value }))}/>
              <input_1.Input placeholder="City" value={partnerForm.city} onChange={(event) => setPartnerForm((prev) => ({ ...prev, city: event.target.value }))}/>
              <input_1.Input placeholder="Territory" value={partnerForm.territory} onChange={(event) => setPartnerForm((prev) => ({ ...prev, territory: event.target.value }))}/>
              <select_1.Select value={partnerForm.partner_type} onChange={(event) => setPartnerForm((prev) => ({ ...prev, partner_type: event.target.value }))}>
                {segmentOptions.map((segment) => (<option key={segment} value={segment}>{segmentLabel(segment)}</option>))}
              </select_1.Select>
              <button_1.Button onClick={createPartner} disabled={submitting}>
                <lucide_react_1.Plus className="h-4 w-4"/>
                Add Partner
              </button_1.Button>
            </div>

            <div className="overflow-x-auto">
              <table_1.Table>
                <table_1.TableHead>
                  <tr>
                    <table_1.TH>Company</table_1.TH>
                    <table_1.TH>Type</table_1.TH>
                    <table_1.TH>Territory</table_1.TH>
                    <table_1.TH>Contact</table_1.TH>
                  </tr>
                </table_1.TableHead>
                <table_1.TableBody>
                  {referralPartners.slice(0, 8).map((row) => (<tr key={row.id}>
                      <table_1.TD>
                        <div>
                          <p className="font-medium">{row.company_name}</p>
                          <p className="text-xs text-semantic-muted">{row.source || "manual"}</p>
                        </div>
                      </table_1.TD>
                      <table_1.TD>{segmentLabel(row.partner_type)}</table_1.TD>
                      <table_1.TD>{row.territory || [row.city, row.state].filter(Boolean).join(", ") || "-"}</table_1.TD>
                      <table_1.TD>{row.contact_name || row.email || row.phone || "-"}</table_1.TD>
                    </tr>))}
                </table_1.TableBody>
              </table_1.Table>
            </div>
          </card_1.CardBody>
        </card_1.Card>
      </section>

      <card_1.Card>
        <card_1.CardHeader>
          <h2 className="dashboard-section-title text-semantic-text">Outbound Lists</h2>
        </card_1.CardHeader>
        <card_1.CardBody>
          {loading ? (<p className="text-sm text-semantic-muted">Loading outbound lists...</p>) : outboundLists.length === 0 ? (<p className="text-sm text-semantic-muted">Create a list manually or generate one from an incident opportunity.</p>) : (<div className="overflow-x-auto">
              <table_1.Table>
                <table_1.TableHead>
                  <tr>
                    <table_1.TH>List</table_1.TH>
                    <table_1.TH>Type</table_1.TH>
                    <table_1.TH>Territory</table_1.TH>
                    <table_1.TH>Members</table_1.TH>
                    <table_1.TH>Status</table_1.TH>
                    <table_1.TH>Actions</table_1.TH>
                  </tr>
                </table_1.TableHead>
                <table_1.TableBody>
                  {outboundLists.map((row) => (<tr key={row.id}>
                      <table_1.TD>
                        <div>
                          <p className="font-medium">{row.name}</p>
                          <p className="text-xs text-semantic-muted">{row.source_trigger || row.campaign_name || "manual list"}</p>
                        </div>
                      </table_1.TD>
                      <table_1.TD>{segmentLabel(row.list_type)}</table_1.TD>
                      <table_1.TD>{row.territory || "-"}</table_1.TD>
                      <table_1.TD>{row.member_count || 0}</table_1.TD>
                      <table_1.TD>
                        <badge_1.Badge variant={row.export_status === "synced" ? "success" : "default"}>{row.export_status}</badge_1.Badge>
                      </table_1.TD>
                      <table_1.TD>
                        <div className="flex flex-wrap gap-2">
                          <button_1.Button size="sm" variant="secondary" onClick={() => exportList(row.id)}>
                            <lucide_react_1.Download className="h-4 w-4"/>
                            Export
                          </button_1.Button>
                          <button_1.Button size="sm" onClick={() => syncList(row.id, row.smartlead_campaign_id)} disabled={syncingId === row.id}>
                            <lucide_react_1.Send className="h-4 w-4"/>
                            {syncingId === row.id ? "Syncing..." : "Push to Smartlead"}
                          </button_1.Button>
                        </div>
                      </table_1.TD>
                    </tr>))}
                </table_1.TableBody>
              </table_1.Table>
            </div>)}
        </card_1.CardBody>
      </card_1.Card>
    </div>);
}
function parseCsv(raw) {
    const lines = raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    if (lines.length < 2)
        return [];
    const header = lines[0].split(",").map((part) => part.trim().toLowerCase());
    return lines.slice(1).map((line) => {
        const values = line.split(",").map((part) => part.trim());
        const row = Object.fromEntries(header.map((key, index) => [key, values[index] || ""]));
        return {
            name: row.company_name || row.name || "",
            phone: row.phone || "",
            email: row.email || "",
            service_type: row.segment || row.prospect_type || "property_manager",
            city: row.city || "",
            state: row.state || "NY",
            postal_code: row.zip || row.postal_code || "",
            tags: [row.segment || row.prospect_type || "imported"].filter(Boolean)
        };
    });
}
function StatCard({ label, value, helper, icon: Icon }) {
    return (<card_1.Card>
      <card_1.CardBody className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-semantic-muted">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-semantic-text">{value}</p>
          <p className="mt-2 text-sm text-semantic-muted">{helper}</p>
        </div>
        <div className="rounded-xl bg-brand-50 p-3 text-brand-700">
          <Icon className="h-5 w-5"/>
        </div>
      </card_1.CardBody>
    </card_1.Card>);
}
