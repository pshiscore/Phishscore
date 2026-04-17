export const QS_TAXONOMY = [
  {
    id: 'voip',
    label: 'VOIP Fraud',
    color: '#38bdf8',
    rawTypes: ['phone', 'phone number', 'caller id'],
  },
  {
    id: 'phishing',
    label: 'Phishing Activity',
    color: '#f43f5e',
    rawTypes: ['email', 'email address'],
  },
  {
    id: 'infrastructure',
    label: 'Infrastructure',
    color: '#a78bfa',
    rawTypes: ['ip', 'ip address', 'domain', 'url'],
  },
  {
    id: 'financial',
    label: 'Financial Fraud',
    color: '#facc15',
    rawTypes: ['wallet', 'crypto', 'bitcoin'],
  },
  {
    id: 'general',
    label: 'General Intel',
    color: '#94a3b8',
    rawTypes: [],
  },
];

export function getQsTaxonomy(inputType) {
  if (!inputType) return QS_TAXONOMY.find(t => t.id === 'general');
  const normalized = inputType.toLowerCase().trim();
  return (
    QS_TAXONOMY.find(t => t.rawTypes.includes(normalized)) ||
    QS_TAXONOMY.find(t => t.id === 'general')
  );
}
