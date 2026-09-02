import { Category } from '@/types';

export { Category };

export const categories: Category[] = [
  {
    id: 'cybersecurity',
    name: { tr: 'Siber Güvenlik', en: 'Cybersecurity' },
    icon: '🛡️',
    color: '#E17055',
    subcategories: [
      {
        id: 'cybersecurity-general',
        name: { tr: 'Genel Terimler', en: 'General Terms' },
        icon: '🔒',
        color: '#E17055',
      },
      {
        id: 'blue-team',
        name: { tr: 'Blue Team (Savunma)', en: 'Blue Team (Defense)' },
        icon: '🔵',
        color: '#0984E3',
        subcategories: [
          {
            id: 'siem-log-analysis',
            name: { tr: 'SIEM & Log Analizi', en: 'SIEM & Log Analysis' },
            icon: '📊',
            color: '#0984E3',
          },
          {
            id: 'incident-response',
            name: { tr: 'Olay Müdahale', en: 'Incident Response' },
            icon: '🚨',
            color: '#0984E3',
          },
          {
            id: 'threat-intelligence',
            name: { tr: 'Tehdit İstihbaratı', en: 'Threat Intelligence' },
            icon: '🔍',
            color: '#0984E3',
          },
        ],
      },
      {
        id: 'red-team',
        name: { tr: 'Red Team (Saldırı)', en: 'Red Team (Offense)' },
        icon: '🔴',
        color: '#D63031',
        subcategories: [
          {
            id: 'reconnaissance',
            name: { tr: 'Keşif', en: 'Reconnaissance' },
            icon: '🔭',
            color: '#D63031',
          },
          {
            id: 'exploitation',
            name: { tr: 'İstismar', en: 'Exploitation' },
            icon: '💥',
            color: '#D63031',
          },
          {
            id: 'social-engineering',
            name: { tr: 'Sosyal Mühendislik', en: 'Social Engineering' },
            icon: '🎭',
            color: '#D63031',
          },
        ],
      },
      {
        id: 'cryptography',
        name: { tr: 'Kriptografi', en: 'Cryptography' },
        icon: '🔐',
        color: '#6C5CE7',
      },
      {
        id: 'malware',
        name: { tr: 'Malware Analizi', en: 'Malware Analysis' },
        icon: '🦠',
        color: '#00B894',
      },
      {
        id: 'owasp-web-security',
        name: { tr: 'OWASP & Web Güvenliği', en: 'OWASP & Web Security' },
        icon: '🌐',
        color: '#FDCB6E',
      },
    ],
  },
  {
    id: 'software-dev',
    name: { tr: 'Yazılım Geliştirme', en: 'Software Development' },
    icon: '💻',
    color: '#0984E3',
    subcategories: [
      {
        id: 'web-frontend',
        name: { tr: 'Web Frontend', en: 'Web Frontend' },
        icon: '🎨',
        color: '#E84393',
      },
      {
        id: 'web-backend',
        name: { tr: 'Web Backend', en: 'Web Backend' },
        icon: '⚙️',
        color: '#00CEC9',
      },
      {
        id: 'database',
        name: { tr: 'Veritabanı & SQL', en: 'Database & SQL' },
        icon: '🗄️',
        color: '#FDCB6E',
      },
      {
        id: 'devops',
        name: { tr: 'DevOps & CI/CD', en: 'DevOps & CI/CD' },
        icon: '🔄',
        color: '#6C5CE7',
      },
      {
        id: 'git-version-control',
        name: { tr: 'Git & Versiyon Kontrol', en: 'Git & Version Control' },
        icon: '📝',
        color: '#E17055',
      },
      {
        id: 'testing',
        name: { tr: 'Test & QA', en: 'Testing & QA' },
        icon: '✅',
        color: '#00B894',
      },
    ],
  },
];

export function getAllTags(): string[] {
  const tags = new Set<string>();
  function walk(cats: Category[]) {
    for (const cat of cats) {
      tags.add(cat.id);
      if (cat.subcategories) walk(cat.subcategories);
    }
  }
  walk(categories);
  return Array.from(tags);
}

export function getCategoryByTag(tag: string): Category | undefined {
  function find(cats: Category[]): Category | undefined {
    for (const cat of cats) {
      if (cat.id === tag) return cat;
      if (cat.subcategories) {
        const found = find(cat.subcategories);
        if (found) return found;
      }
    }
  }
  return find(categories);
}
