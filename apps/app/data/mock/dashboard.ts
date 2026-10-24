/**
 * Design-preview fixtures for the redesigned dashboard.
 *
 * The redesigned dashboard renders from these constants so the layout can be
 * reviewed without a live API. Every section maps 1:1 to a future query
 * (`queries.*`) — swap the mock import for the query hook when wiring real
 * data, keeping the shapes below as the component contract.
 */

export type MockStorageSegment = {
  label: string
  bytes: number
  /** Tailwind bg class for the bar segment and its legend dot. */
  colorClass: string
}

export type MockRecentFile = {
  id: string
  name: string
  sizeLabel: string
  typeLabel: string
}

export type MockFrequentFolder = {
  id: string
  name: string
  openedLabel: string
}

export type MockOverviewFile = {
  id: string
  name: string
  dateUploaded: string
  lastUpdated: string
  sizeLabel: string
  typeLabel: string
  owner: { name: string; initials: string }
}

export type MockMember = {
  id: string
  name: string
  initials: string
}

export const MOCK_USER = {
  name: 'Ruben Vaccaro',
  email: 'ruben.vaccaro@acme.io',
}

export const MOCK_ORG = {
  id: 'org-preview-acme',
  name: 'Acme Studio',
  slug: 'acme-studio',
}

export const MOCK_WORKSPACES = [
  { id: 'ws-preview-acme-team', name: 'Acme Team', slug: 'acme-team' },
  { id: 'ws-preview-personal', name: 'Personal', slug: 'personal' },
  { id: 'ws-preview-media', name: 'Image / Video', slug: 'image-video' },
]

export const MOCK_INSIGHT =
  'Video files account for 42% of your storage and increased 18% this month. Consider archiving old videos to free up space.'

/** File-type breakdown of the workspace storage; free space is derived from the 1 TB quota.
 *  Byte values are binary units (GiB) so formatBytes renders the intended labels. */
export const MOCK_STORAGE_SEGMENTS: MockStorageSegment[] = [
  { label: 'Videos', bytes: 131 * 1024 ** 3, colorClass: 'bg-primary' },
  { label: 'Documents', bytes: 169 * 1024 ** 3, colorClass: 'bg-amber-500' },
  { label: 'Images', bytes: 84 * 1024 ** 3, colorClass: 'bg-violet-500' },
  { label: 'Other', bytes: 115 * 1024 ** 3, colorClass: 'bg-zinc-900 dark:bg-zinc-300' },
]

export const MOCK_STORAGE_TOTAL = 1024 ** 4

export const MOCK_RECENT_FILES: MockRecentFile[] = [
  { id: 'f1', name: 'Annual-Report-2025.pdf', sizeLabel: '4.8 MB', typeLabel: 'Document' },
  { id: 'f2', name: 'Marketing-Strategy.docx', sizeLabel: '2.6 MB', typeLabel: 'Document' },
  { id: 'f3', name: 'Budget-Planning.xlsx', sizeLabel: '1.9 MB', typeLabel: 'Spreadsheet' },
  { id: 'f4', name: 'Workspace-Setup.jpg', sizeLabel: '4.2 MB', typeLabel: 'Image' },
  { id: 'f5', name: 'Brand-Assets.zip', sizeLabel: '48 MB', typeLabel: 'Archive' },
  { id: 'f6', name: 'Kickoff-Notes.md', sizeLabel: '12 KB', typeLabel: 'Document' },
]

export const MOCK_FREQUENT_FOLDERS: MockFrequentFolder[] = [
  { id: 'fd1', name: 'Brand Guideline', openedLabel: 'Opened 15m ago' },
  { id: 'fd2', name: 'Marketing Campaign', openedLabel: 'Opened 45m ago' },
  { id: 'fd3', name: 'Team Resources', openedLabel: 'Opened 1h ago' },
  { id: 'fd4', name: 'Design Library', openedLabel: 'Opened 3h ago' },
  { id: 'fd5', name: 'Client Deliverables', openedLabel: 'Opened 5h ago' },
  { id: 'fd6', name: 'Personal Archive', openedLabel: 'Opened 1d ago' },
]

export const MOCK_OVERVIEW_FILES: MockOverviewFile[] = [
  {
    id: 'o1',
    name: 'Brand-Guideline.pdf',
    dateUploaded: 'Sep 18, 2026, 15:30',
    lastUpdated: '14 minutes ago',
    sizeLabel: '8.25 MB',
    typeLabel: 'Document',
    owner: { name: 'Livia Botosh', initials: 'LB' },
  },
  {
    id: 'o2',
    name: 'Marketing-Strategy.pptx',
    dateUploaded: 'Oct 2, 2026, 09:15',
    lastUpdated: '1 hour ago',
    sizeLabel: '22.4 MB',
    typeLabel: 'Presentation',
    owner: { name: 'Jamal Ortiz', initials: 'JO' },
  },
  {
    id: 'o3',
    name: 'User-Feedback.xlsx',
    dateUploaded: 'Oct 1, 2026, 17:45',
    lastUpdated: '18 hours ago',
    sizeLabel: '3.6 MB',
    typeLabel: 'Spreadsheet',
    owner: { name: 'Sofia Nguyen', initials: 'SN' },
  },
  {
    id: 'o4',
    name: 'Product-Roadmap.docx',
    dateUploaded: 'Sep 29, 2026, 11:20',
    lastUpdated: '2 days ago',
    sizeLabel: '1.8 MB',
    typeLabel: 'Document',
    owner: { name: 'Livia Botosh', initials: 'LB' },
  },
  {
    id: 'o5',
    name: 'Workspace-Setup.jpg',
    dateUploaded: 'Sep 25, 2026, 08:05',
    lastUpdated: '4 days ago',
    sizeLabel: '4.2 MB',
    typeLabel: 'Image',
    owner: { name: 'Noah Kim', initials: 'NK' },
  },
  {
    id: 'o6',
    name: 'Design-Library.zip',
    dateUploaded: 'Sep 21, 2026, 14:40',
    lastUpdated: '6 days ago',
    sizeLabel: '112 MB',
    typeLabel: 'Archive',
    owner: { name: 'Jamal Ortiz', initials: 'JO' },
  },
  {
    id: 'o7',
    name: 'Team-Charter.md',
    dateUploaded: 'Sep 12, 2026, 10:10',
    lastUpdated: '2 weeks ago',
    sizeLabel: '36 KB',
    typeLabel: 'Document',
    owner: { name: 'Sofia Nguyen', initials: 'SN' },
  },
]

export const MOCK_MEMBERS: MockMember[] = [
  { id: 'm1', name: 'Livia Botosh', initials: 'LB' },
  { id: 'm2', name: 'Jamal Ortiz', initials: 'JO' },
  { id: 'm3', name: 'Sofia Nguyen', initials: 'SN' },
  { id: 'm4', name: 'Noah Kim', initials: 'NK' },
  { id: 'm5', name: 'Ava Marino', initials: 'AM' },
]

export const MOCK_MEMBER_TOTAL = 15
