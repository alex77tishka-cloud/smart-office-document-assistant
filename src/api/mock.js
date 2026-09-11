// Phase 1 mock data and mock transport.
//
// Rows are kept in the RAW Google Sheet shape returned by GET /webhook/documents
// (CONTRACT.md 1.B), including the real column names, so the normaliser is
// exercised exactly as it will be against live data. Newest first.
//
// Nothing here talks to the network. No business logic lives here — urgency,
// responsible team and summaries are values n8n would have produced.

import { ApiError, ERROR_CODES } from './errors.js'
import { sameDocumentId } from '../lib/review.js'

export const MOCK_DOCUMENTS = [
  {
    row_number: 9,
    'Received At': '2026-09-10 09:14',
    Customer: 'Northwind Automotive',
    'End Customer': 'Volvo Trucks',
    'Project / Program': 'EV Powertrain Harness 2027',
    'Request Type': 'RFQ',
    'TE Part Number(s)': '1-1418469-1, 2141851-2',
    'Competitor Part Number(s)': 'MX150-33482',
    'Product Family': 'Sealed Connectors',
    Quantity: '120,000',
    'Target Price': '2.15 EUR',
    'Required Delivery': '2027-01-15',
    'Response Deadline': '2026-09-12',
    Competitor: 'Molex',
    Summary:
      'Customer requests quotation for sealed connector assemblies for a new EV powertrain harness. Target price is below current list; volumes ramp from Q1 2027.',
    'Requested Action': 'Provide quotation and confirm tooling lead time',
    'Responsible Team': 'Automotive Sales',
    Urgency: 'High',
    'Strategic Opportunity': 'Yes',
    'File Name': 'northwind-rfq-ev-harness.pdf',
    'File Link': 'https://drive.google.com/file/d/mock-northwind-rfq/view',
    Status: 'Needs Review',
    // Trailing whitespace on purpose: real Sheet values carry stray spaces,
    // and every Document ID comparison must survive it.
    'Document ID': 'DOC-2026-0912 ',
    'Reviewed By': '',
    'Review Note': '',
  },
  {
    row_number: 8,
    'Received At': '2026-09-09 16:40',
    Customer: 'Baltic Rail Systems',
    'End Customer': 'Deutsche Bahn',
    'Project / Program': 'Regional Fleet Refurbishment',
    'Request Type': 'Technical Enquiry',
    'TE Part Number(s)': '2-1934567-3',
    'Competitor Part Number(s)': '',
    'Product Family': 'Industrial Relays',
    Quantity: '4,500',
    'Target Price': '',
    'Required Delivery': '2026-11-30',
    'Response Deadline': '2026-09-18',
    Competitor: '',
    Summary:
      'Enquiry about temperature derating curves and vibration rating for relays used in a rail refurbishment programme.',
    'Requested Action': 'Confirm derating data and provide datasheet revision',
    'Responsible Team': 'Application Engineering',
    Urgency: 'Medium',
    'Strategic Opportunity': 'No',
    'File Name': 'baltic-rail-technical-enquiry.pdf',
    'File Link': 'https://drive.google.com/file/d/mock-baltic-rail/view',
    Status: 'Reviewed',
    'Document ID': 'DOC-2026-0911',
    'Reviewed By': 'M. Laurent',
    'Review Note': 'Derating curves sent 09-09. Datasheet rev C attached in reply.',
  },
  {
    row_number: 7,
    'Received At': '2026-09-09 11:02',
    Customer: 'Helios Medical',
    'End Customer': '',
    'Project / Program': 'Infusion Pump Gen 4',
    'Request Type': 'RFQ',
    'TE Part Number(s)': '1877848-1, 1877849-1',
    'Competitor Part Number(s)': 'JST-SHLP-02V',
    'Product Family': 'Wire-to-Board',
    Quantity: '85,000',
    'Target Price': '0.42 USD',
    'Required Delivery': '2026-12-01',
    'Response Deadline': '2026-09-11',
    Competitor: 'JST',
    Summary:
      'Competitive RFQ for wire-to-board connectors on a medical infusion pump. Customer is actively benchmarking against JST pricing.',
    'Requested Action': 'Quote with volume breaks and confirm medical compliance documentation',
    'Responsible Team': 'Medical Sales',
    Urgency: 'High',
    'Strategic Opportunity': 'Yes',
    'File Name': 'helios-medical-rfq-gen4.pdf',
    'File Link': 'https://drive.google.com/file/d/mock-helios-rfq/view',
    Status: 'Reviewed',
    'Document ID': 'DOC-2026-0910',
    'Reviewed By': 'A. Petrov',
    'Review Note': 'Escalated to pricing desk. Compliance pack requested from QA.',
  },
  {
    row_number: 6,
    'Received At': '2026-09-08 14:27',
    Customer: 'Meridian Aerospace',
    'End Customer': 'Airbus Defence',
    'Project / Program': 'Ground Support Equipment',
    'Request Type': 'Sample Request',
    'TE Part Number(s)': 'DEUTSCH DT04-6P',
    'Competitor Part Number(s)': '',
    'Product Family': 'Heavy Duty Connectors',
    Quantity: '25',
    'Target Price': '',
    'Required Delivery': '2026-10-05',
    'Response Deadline': '2026-09-22',
    Competitor: '',
    Summary:
      'Sample request for six-position heavy duty connectors to validate a ground support equipment redesign.',
    'Requested Action': 'Ship samples and confirm qualification timeline',
    'Responsible Team': 'Aerospace Sales',
    Urgency: 'Low',
    'Strategic Opportunity': 'No',
    'File Name': 'meridian-sample-request.docx',
    'File Link': 'https://drive.google.com/file/d/mock-meridian-sample/view',
    Status: 'Needs Review',
    'Document ID': 'DOC-2026-0909',
    'Reviewed By': '',
    'Review Note': '',
  },
  {
    row_number: 5,
    'Received At': '2026-09-08 08:55',
    Customer: 'Cascade Energy',
    'End Customer': '',
    'Project / Program': '',
    'Request Type': 'General Enquiry',
    'TE Part Number(s)': '',
    'Competitor Part Number(s)': '',
    'Product Family': '',
    Quantity: '',
    'Target Price': '',
    'Required Delivery': '',
    'Response Deadline': '',
    Competitor: '',
    Summary:
      'Short email asking who handles solar inverter connector enquiries in the Nordics. No technical detail supplied.',
    'Requested Action': 'Route to regional contact',
    'Responsible Team': 'Energy Sales',
    Urgency: 'Medium',
    'Strategic Opportunity': '',
    'File Name': 'cascade-energy-enquiry.txt',
    'File Link': 'https://drive.google.com/file/d/mock-cascade-enquiry/view',
    Status: 'Needs Review',
    'Document ID': 'DOC-2026-0908',
    'Reviewed By': '',
    'Review Note': '',
  },
  {
    // Legacy row: predates Workflow A, so Document ID is empty and the app must
    // not offer review for it (SPEC.md 5.4.1).
    row_number: 4,
    'Received At': '2026-08-27 10:11',
    Customer: 'Orion Robotics',
    'End Customer': 'Fanuc',
    'Project / Program': 'Cobot Arm v2',
    'Request Type': 'RFQ',
    'TE Part Number(s)': '2213456-1',
    'Competitor Part Number(s)': 'HRS-DF11',
    'Product Family': 'Wire-to-Board',
    Quantity: '30,000',
    'Target Price': '0.88 EUR',
    'Required Delivery': '2026-12-15',
    'Response Deadline': '2026-09-05',
    Competitor: 'Hirose',
    Summary:
      'Legacy record imported before Document ID was introduced. Quotation request for cobot arm internal wiring.',
    'Requested Action': 'Provide quotation',
    'Responsible Team': 'Industrial Sales',
    Urgency: 'Medium',
    'Strategic Opportunity': 'Yes',
    'File Name': 'orion-robotics-rfq-legacy.pdf',
    'File Link': 'https://drive.google.com/file/d/mock-orion-legacy/view',
    Status: '',
    'Document ID': '',
    'Reviewed By': '',
    'Review Note': '',
  },
  {
    row_number: 3,
    'Received At': '2026-08-26 13:36',
    Customer: 'Sable Appliances',
    'End Customer': '',
    'Project / Program': 'Dishwasher Platform 9',
    'Request Type': 'Technical Enquiry',
    'TE Part Number(s)': '350809-1',
    'Competitor Part Number(s)': '',
    'Product Family': 'Terminals & Splices',
    Quantity: '600,000',
    'Target Price': '0.06 EUR',
    'Required Delivery': '2027-03-01',
    'Response Deadline': '2026-09-30',
    Competitor: 'Amphenol',
    Summary:
      'Enquiry about crimp tooling compatibility for high volume terminal supply on a white goods platform.',
    'Requested Action': 'Confirm applicator compatibility and crimp specification',
    'Responsible Team': 'Application Engineering',
    Urgency: 'Low',
    'Strategic Opportunity': 'No',
    'File Name': 'sable-crimp-tooling.pdf',
    'File Link': 'https://drive.google.com/file/d/mock-sable-crimp/view',
    Status: 'Reviewed',
    'Document ID': 'DOC-2026-0806',
    'Reviewed By': 'M. Laurent',
    'Review Note': 'Applicator list confirmed with tooling team.',
  },
  {
    row_number: 2,
    'Received At': '2026-08-25 09:48',
    Customer: 'Northwind Automotive',
    'End Customer': 'Scania',
    'Project / Program': 'Chassis Sensor Loom',
    'Request Type': 'RFQ',
    'TE Part Number(s)': '1-967325-1',
    'Competitor Part Number(s)': 'Aptiv-15326842',
    'Product Family': 'Sealed Connectors',
    Quantity: '45,000',
    'Target Price': '1.10 EUR',
    'Required Delivery': '2026-11-20',
    'Response Deadline': '2026-08-29',
    Competitor: 'Aptiv',
    Summary:
      'Repeat quotation request for sealed connectors on a chassis sensor loom, competing directly against an Aptiv incumbent part.',
    'Requested Action': 'Requote with updated volume assumptions',
    'Responsible Team': 'Automotive Sales',
    Urgency: 'High',
    'Strategic Opportunity': 'Yes',
    'File Name': 'northwind-chassis-loom-rfq.pdf',
    'File Link': 'https://drive.google.com/file/d/mock-northwind-chassis/view',
    Status: 'Needs Review',
    'Document ID': 'DOC-2026-0805',
    'Reviewed By': '',
    'Review Note': '',
  },
]

// Mock-only scenario switch, so loading, empty and error states can be
// demonstrated offline (SPEC.md build phase 1). Not a business field.
export const MOCK_SCENARIOS = {
  NORMAL: 'normal',
  EMPTY: 'empty',
  ERROR: 'error',
  SLOW: 'slow',
}

function freshRows() {
  return MOCK_DOCUMENTS.map((row) => ({ ...row }))
}

// The mock store lives in memory for the session so a simulated review is
// visible on the dashboard. Mock mode only — nothing is persisted, and Google
// Sheets stays the single source of truth once Phase 2 lands.
//
// It is held in `import.meta.hot.data` because Vite re-executes this module on
// every hot update. Plain module-level state would silently reset mid-session,
// throwing away reviews already recorded and making the next read return rows
// that no longer reflect them. `import.meta.hot` is undefined in a production
// build, where a fresh store per page load is exactly right.
const store = import.meta.hot?.data.store ?? {
  rows: freshRows(),
  scenario: MOCK_SCENARIOS.NORMAL,
}

if (import.meta.hot) {
  import.meta.hot.data.store = store
}

export function getMockScenario() {
  return store.scenario
}

export function setMockScenario(next) {
  store.scenario = Object.values(MOCK_SCENARIOS).includes(next)
    ? next
    : MOCK_SCENARIOS.NORMAL
}

function wait(ms) {
  const factor = store.scenario === MOCK_SCENARIOS.SLOW ? 4 : 1
  return new Promise((resolve) => setTimeout(resolve, ms * factor))
}

export function resetMockDocuments() {
  store.rows = freshRows()
}

export async function mockGetDocuments() {
  await wait(650)
  if (store.scenario === MOCK_SCENARIOS.ERROR) {
    throw new ApiError(
      ERROR_CODES.UPSTREAM_UNREACHABLE,
      'Could not reach the document service.',
      'Mock scenario: simulated upstream failure.',
    )
  }
  if (store.scenario === MOCK_SCENARIOS.EMPTY) return []
  return store.rows.map((row) => ({ ...row }))
}

export async function mockProcessDocument({ file_name, mime_type }) {
  await wait(2600)
  if (store.scenario === MOCK_SCENARIOS.ERROR) {
    throw new ApiError(
      ERROR_CODES.UPSTREAM_ERROR,
      'The document could not be processed.',
      'Mock scenario: simulated processing failure.',
    )
  }

  const documentId = `DOC-2026-${String(9000 + store.rows.length).slice(-4)}`
  const receivedAt = new Date().toISOString().slice(0, 16).replace('T', ' ')

  // Shape matches CONTRACT.md 1.A exactly. Field values stand in for what the
  // n8n AI extraction would have returned.
  const response = {
    status: 'processed',
    document_id: documentId,
    file_name,
    file_link: `https://drive.google.com/file/d/mock-${documentId.toLowerCase()}/view`,
    received_at: receivedAt,
    fields: {
      customer: 'Lakeside Instruments',
      end_customer: 'Siemens Healthineers',
      project_or_program: 'Analyser Module Refresh',
      request_type: 'RFQ',
      te_part_numbers: '2-1445022-4',
      competitor_part_numbers: 'Molex-5023510500',
      product_family: 'Board-to-Board',
      quantity: '18,000',
      target_price: '1.34 EUR',
      required_delivery: '2027-02-10',
      response_deadline: '2026-09-24',
      competitor: 'Molex',
      summary: `Extracted from ${file_name} (${mime_type}). Quotation request for board-to-board connectors on a laboratory analyser module refresh.`,
      requested_action: 'Provide quotation and confirm sample availability',
      responsible_team: 'Industrial Sales',
      urgency: 'Medium',
      strategic_opportunity: 'Yes',
    },
    notification_sent: true,
  }

  // Keep the new document visible on the mock dashboard, newest first.
  store.rows = [
    {
      row_number: store.rows.length + 2,
      'Received At': receivedAt,
      Customer: response.fields.customer,
      'End Customer': response.fields.end_customer,
      'Project / Program': response.fields.project_or_program,
      'Request Type': response.fields.request_type,
      'TE Part Number(s)': response.fields.te_part_numbers,
      'Competitor Part Number(s)': response.fields.competitor_part_numbers,
      'Product Family': response.fields.product_family,
      Quantity: response.fields.quantity,
      'Target Price': response.fields.target_price,
      'Required Delivery': response.fields.required_delivery,
      'Response Deadline': response.fields.response_deadline,
      Competitor: response.fields.competitor,
      Summary: response.fields.summary,
      'Requested Action': response.fields.requested_action,
      'Responsible Team': response.fields.responsible_team,
      Urgency: response.fields.urgency,
      'Strategic Opportunity': response.fields.strategic_opportunity,
      'File Name': response.file_name,
      'File Link': response.file_link,
      Status: 'Needs Review',
      'Document ID': response.document_id,
      'Reviewed By': '',
      'Review Note': '',
    },
    ...store.rows,
  ]

  return response
}

export async function mockSubmitReview({
  document_id,
  status,
  reviewed_by,
  review_note,
}) {
  await wait(900)
  if (store.scenario === MOCK_SCENARIOS.ERROR) {
    throw new ApiError(
      ERROR_CODES.UPSTREAM_ERROR,
      'The review could not be recorded.',
      'Mock scenario: simulated upstream failure.',
    )
  }

  const row = store.rows.find((item) =>
    sameDocumentId(item['Document ID'], document_id),
  )
  if (!row) {
    // Mirrors the upstream 404 (CONTRACT.md 1.C).
    throw new ApiError(
      ERROR_CODES.DOCUMENT_NOT_FOUND,
      'No matching document was found for this ID.',
      `Mock: no row with Document ID "${document_id}".`,
    )
  }

  // Mock mode only: the write happens locally. In live mode n8n writes to Sheets.
  row.Status = status
  row['Reviewed By'] = reviewed_by
  row['Review Note'] = review_note

  return {
    success: true,
    document_id,
    status,
    reviewed_by,
    review_note,
  }
}
