/**
 * Template Status Mapper
 * 
 * Normaliza e traduz status de templates da Meta (WhatsApp Business Platform)
 * para uso interno na aplicação.
 * 
 * @see https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates
 */

// Canonical internal status
export type CanonicalTemplateStatus = 
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'PAUSED'
  | 'DISABLED'
  | 'IN_APPEAL'
  | 'FLAGGED'
  | 'UNKNOWN';

// Status returned by Meta API (case insensitive)
type MetaTemplateStatus = 
  | 'PENDING'
  | 'APPROVED'
  | 'ACTIVE'
  | 'REJECTED'
  | 'PAUSED'
  | 'DISABLED'
  | 'IN_APPEAL'
  | 'FLAGGED'
  | 'LIMIT_EXCEEDED'
  | 'DELETED';

/**
 * Maps Meta API status to canonical internal status
 */
export function normalizeMetaStatus(metaStatus: string | null | undefined): CanonicalTemplateStatus {
  if (!metaStatus) return 'UNKNOWN';
  
  const normalized = metaStatus.toUpperCase().trim();
  
  const statusMap: Record<string, CanonicalTemplateStatus> = {
    'PENDING': 'IN_REVIEW',
    'APPROVED': 'APPROVED',
    'ACTIVE': 'APPROVED', // Legacy/fallback
    'REJECTED': 'REJECTED',
    'PAUSED': 'PAUSED',
    'DISABLED': 'DISABLED',
    'IN_APPEAL': 'IN_APPEAL',
    'FLAGGED': 'FLAGGED',
    'LIMIT_EXCEEDED': 'DISABLED',
    'DELETED': 'DISABLED',
  };
  
  return statusMap[normalized] || 'UNKNOWN';
}

/**
 * Maps canonical status to PT-BR label
 */
export function getStatusLabel(status: CanonicalTemplateStatus | string): string {
  const normalized = normalizeMetaStatus(status);
  
  const labelMap: Record<CanonicalTemplateStatus, string> = {
    'IN_REVIEW': 'Em análise',
    'APPROVED': 'Aprovado',
    'REJECTED': 'Reprovado',
    'PAUSED': 'Pausado',
    'DISABLED': 'Desativado',
    'IN_APPEAL': 'Em recurso',
    'FLAGGED': 'Sinalizado',
    'UNKNOWN': 'Desconhecido',
  };
  
  return labelMap[normalized] || 'Desconhecido';
}

/**
 * Get status color classes for badges
 */
export function getStatusColorClasses(status: CanonicalTemplateStatus | string): {
  bg: string;
  text: string;
  hover: string;
} {
  const normalized = normalizeMetaStatus(status);
  
  const colorMap: Record<CanonicalTemplateStatus, { bg: string; text: string; hover: string }> = {
    'APPROVED': {
      bg: 'bg-green-500/10',
      text: 'text-green-600',
      hover: 'hover:bg-green-500/20',
    },
    'IN_REVIEW': {
      bg: 'bg-yellow-500/10',
      text: 'text-yellow-600',
      hover: 'hover:bg-yellow-500/20',
    },
    'REJECTED': {
      bg: 'bg-red-500/10',
      text: 'text-red-600',
      hover: 'hover:bg-red-500/20',
    },
    'PAUSED': {
      bg: 'bg-orange-500/10',
      text: 'text-orange-600',
      hover: 'hover:bg-orange-500/20',
    },
    'DISABLED': {
      bg: 'bg-gray-500/10',
      text: 'text-gray-500',
      hover: 'hover:bg-gray-500/20',
    },
    'IN_APPEAL': {
      bg: 'bg-blue-500/10',
      text: 'text-blue-600',
      hover: 'hover:bg-blue-500/20',
    },
    'FLAGGED': {
      bg: 'bg-purple-500/10',
      text: 'text-purple-600',
      hover: 'hover:bg-purple-500/20',
    },
    'UNKNOWN': {
      bg: 'bg-gray-500/10',
      text: 'text-gray-400',
      hover: 'hover:bg-gray-500/20',
    },
  };
  
  return colorMap[normalized] || colorMap['UNKNOWN'];
}

/**
 * Filter categories for UI
 */
export type StatusFilterCategory = 
  | 'all'
  | 'approved'
  | 'in_review'
  | 'rejected'
  | 'paused_disabled';

export const STATUS_FILTER_LABELS: Record<StatusFilterCategory, string> = {
  'all': 'Todos',
  'approved': 'Aprovados',
  'in_review': 'Em análise',
  'rejected': 'Reprovados',
  'paused_disabled': 'Pausados/Desativados',
};

/**
 * Get filter category for a template status
 */
export function getFilterCategory(status: string): StatusFilterCategory {
  const normalized = normalizeMetaStatus(status);
  
  switch (normalized) {
    case 'APPROVED':
      return 'approved';
    case 'IN_REVIEW':
      return 'in_review';
    case 'REJECTED':
      return 'rejected';
    case 'PAUSED':
    case 'DISABLED':
      return 'paused_disabled';
    case 'IN_APPEAL':
    case 'FLAGGED':
      return 'in_review'; // Group with in_review
    default:
      return 'all';
  }
}

/**
 * Check if a template matches a filter category
 */
export function matchesFilterCategory(status: string, filter: StatusFilterCategory): boolean {
  if (filter === 'all') return true;
  return getFilterCategory(status) === filter;
}

/**
 * Convert DB status (lowercase) to canonical status
 */
export function dbStatusToCanonical(dbStatus: string | null | undefined): CanonicalTemplateStatus {
  if (!dbStatus) return 'UNKNOWN';
  
  // DB stores lowercase: approved, pending, rejected, etc.
  const statusMap: Record<string, CanonicalTemplateStatus> = {
    'approved': 'APPROVED',
    'pending': 'IN_REVIEW',
    'in_review': 'IN_REVIEW',
    'rejected': 'REJECTED',
    'paused': 'PAUSED',
    'disabled': 'DISABLED',
    'in_appeal': 'IN_APPEAL',
    'flagged': 'FLAGGED',
  };
  
  return statusMap[dbStatus.toLowerCase()] || 'UNKNOWN';
}

/**
 * Convert canonical status to DB status (lowercase)
 */
export function canonicalToDbStatus(canonical: CanonicalTemplateStatus): string {
  const statusMap: Record<CanonicalTemplateStatus, string> = {
    'APPROVED': 'approved',
    'IN_REVIEW': 'pending', // DB uses 'pending' for in_review
    'REJECTED': 'rejected',
    'PAUSED': 'paused',
    'DISABLED': 'disabled',
    'IN_APPEAL': 'in_appeal',
    'FLAGGED': 'flagged',
    'UNKNOWN': 'pending',
  };
  
  return statusMap[canonical] || 'pending';
}

/**
 * Get status icon name (lucide-react)
 */
export function getStatusIconName(status: CanonicalTemplateStatus | string): string {
  const normalized = normalizeMetaStatus(status);
  
  const iconMap: Record<CanonicalTemplateStatus, string> = {
    'APPROVED': 'CheckCircle',
    'IN_REVIEW': 'Clock',
    'REJECTED': 'XCircle',
    'PAUSED': 'PauseCircle',
    'DISABLED': 'MinusCircle',
    'IN_APPEAL': 'Scale',
    'FLAGGED': 'Flag',
    'UNKNOWN': 'HelpCircle',
  };
  
  return iconMap[normalized] || 'HelpCircle';
}
