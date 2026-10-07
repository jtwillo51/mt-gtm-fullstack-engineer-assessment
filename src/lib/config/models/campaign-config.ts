import type { FieldConfig, SectionConfig, ListViewConfig } from '../types'
import { METADATA_FIELDS, RECORD_INFO_SECTION } from '../constants'
import { generateListColumns, columnOverride, computedColumn } from '../column-helpers'
import {
  CAMPAIGN_AUDIENCES,
  CAMPAIGN_INDUSTRIES,
  CAMPAIGN_STATUSES,
  CAMPAIGN_TYPES,
} from '@/lib/schemas/campaign.schema'

// The detail page header carries name, type, status, audience, occasion and
// dates, so those are hidden from the detail body (showInDetail: false) —
// the body leads with Purpose instead of repeating the header.
export const campaignFields: FieldConfig[] = [
  {
    name: 'name',
    label: 'Campaign Name',
    section: 'Campaign Details',
    required: true,
    placeholder: 'e.g. Summer Booking Boost',
    showInDetail: false,
  },
  {
    name: 'type',
    label: 'Type',
    type: 'select',
    options: CAMPAIGN_TYPES,
    section: 'Campaign Details',
    required: true,
    placeholder: 'Select type…',
    showInDetail: false,
  },
  {
    name: 'audience',
    label: 'Audience',
    type: 'select',
    options: CAMPAIGN_AUDIENCES,
    section: 'Campaign Details',
    required: true,
    placeholder: 'Internal or External…',
    renderType: 'badge',
    showInDetail: false,
  },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    options: CAMPAIGN_STATUSES,
    section: 'Campaign Details',
    required: true,
    renderType: 'badge',
    showInDetail: false,
  },
  {
    name: 'occasion',
    label: 'Occasion',
    section: 'Campaign Details',
    placeholder: 'Optional, e.g. 4th of July Sale',
    showInDetail: false,
  },
  {
    name: 'start_date',
    label: 'Start Date',
    type: 'date',
    section: 'Campaign Details',
    renderType: 'date',
    showInDetail: false,
  },
  {
    name: 'end_date',
    label: 'End Date',
    type: 'date',
    section: 'Campaign Details',
    renderType: 'date',
    showInDetail: false,
  },
  {
    name: 'purpose',
    label: 'Purpose',
    type: 'textarea',
    section: 'Purpose',
    placeholder: 'What is this campaign trying to accomplish?',
    renderType: 'multiline',
  },
  {
    name: 'target_industries',
    label: 'Target Industries',
    type: 'multiselect',
    options: CAMPAIGN_INDUSTRIES,
    section: 'Target Industries',
    renderType: 'badge-list',
  },
  ...METADATA_FIELDS,
]

export const campaignSections: SectionConfig[] = [
  { id: 'Campaign Details', columns: 2 },
  { id: 'Purpose', columns: 1, hideFieldLabels: true },
  { id: 'Target Industries', columns: 1, hideFieldLabels: true },
  RECORD_INFO_SECTION,
]

export const campaignListConfig: ListViewConfig = {
  columns: generateListColumns(campaignFields, {
    overrides: [
      columnOverride({ field: 'name', label: 'Campaign', defaultVisible: true, sortable: true }),
      columnOverride({ field: 'type', defaultVisible: true, sortable: true }),
      columnOverride({ field: 'status', defaultVisible: true, sortable: true }),
      columnOverride({ field: 'audience', defaultVisible: true }),
      columnOverride({ field: 'occasion', defaultVisible: true }),
      columnOverride({ field: 'start_date', label: 'Starts', defaultVisible: true }),
      columnOverride({ field: 'end_date', label: 'Ends', defaultVisible: true }),
    ],
    additionalColumns: [
      computedColumn({ field: 'member_count', label: 'Members', defaultVisible: true }),
      computedColumn({ field: 'converted_count', label: 'Converted', defaultVisible: true }),
    ],
    exclude: ['owner_name', 'created_at', 'updated_at', 'purpose'],
  }),
  defaultSort: { field: 'start_date', asc: false },
  searchFields: ['name', 'occasion'],
  searchPlaceholder: 'Search name or occasion',
}
