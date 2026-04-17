export interface Email {
  id: string;
  thread_id?: string;
  from_email: string;
  from_name: string | null;
  to_email: string;
  subject: string;
  body_text: string | null;
  body_html: string | null;
  is_read: boolean;
  is_starred: boolean;
  is_archived: boolean;
  received_at: string;
  message_count?: number;
}

export interface Meta {
  page: number;
  pageSize: number;
  totalFiltered: number;
  total: number;
  unread: number;
  starred: number;
}

export type Filter = 'inbox' | 'unread' | 'starred' | 'archived' | 'all';

export interface FilterOption {
  key: Filter;
  translationKey: string;
}

export const FILTERS: FilterOption[] = [
  { key: 'inbox', translationKey: 'sa.inbox.filterInbox' },
  { key: 'unread', translationKey: 'sa.inbox.filterUnread' },
  { key: 'starred', translationKey: 'sa.inbox.filterStarred' },
  { key: 'archived', translationKey: 'sa.inbox.filterArchived' },
];

export const OUR_EMAIL = 'contato@mail.ainalytics.tech';

export type FlagsUpdate = Partial<Pick<Email, 'is_read' | 'is_starred' | 'is_archived'>>;

export type Target = { threadIds?: string[]; ids?: string[] };
