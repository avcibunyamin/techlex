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
  {
    id: 'ai-ml',
    name: { tr: 'Yapay Zeka & ML', en: 'AI & Machine Learning' },
    icon: '🤖',
    color: '#A29BFE',
    subcategories: [
      {
        id: 'machine-learning',
        name: { tr: 'Makine Öğrenmesi', en: 'Machine Learning' },
        icon: '📈',
        color: '#A29BFE',
      },
      {
        id: 'deep-learning',
        name: { tr: 'Derin Öğrenme', en: 'Deep Learning' },
        icon: '🧠',
        color: '#6C5CE7',
      },
      {
        id: 'llm-nlp',
        name: { tr: 'LLM & NLP', en: 'LLM & NLP' },
        icon: '💬',
        color: '#00CEC9',
      },
      {
        id: 'computer-vision',
        name: { tr: 'Görüntü İşleme', en: 'Computer Vision' },
        icon: '👁️',
        color: '#FDCB6E',
      },
      {
        id: 'big-data',
        name: { tr: 'Büyük Veri', en: 'Big Data' },
        icon: '📊',
        color: '#E17055',
      },
    ],
  },
  {
    id: 'networking',
    name: { tr: 'Ağ Sistemleri', en: 'Networking' },
    icon: '🌐',
    color: '#00B894',
    subcategories: [
      {
        id: 'protocols',
        name: { tr: 'Protokoller', en: 'Protocols' },
        icon: '📡',
        color: '#00B894',
      },
      {
        id: 'network-fundamentals',
        name: { tr: 'Ağ Temelleri', en: 'Network Fundamentals' },
        icon: '🔌',
        color: '#00CEC9',
      },
      {
        id: 'network-devices',
        name: { tr: 'Ağ Cihazları', en: 'Network Devices' },
        icon: '🖧',
        color: '#0984E3',
      },
      {
        id: 'cloud-computing',
        name: { tr: 'Bulut Bilişim', en: 'Cloud Computing' },
        icon: '☁️',
        color: '#6C5CE7',
      },
      {
        id: 'containers',
        name: { tr: 'Konteyner & Orkestrasyon', en: 'Containers & Orchestration' },
        icon: '📦',
        color: '#E84393',
      },
      {
        id: 'wireless',
        name: { tr: 'Kablosuz Ağlar', en: 'Wireless Networks' },
        icon: '📶',
        color: '#FDCB6E',
      },
    ],
  },
  {
    id: 'design-ux',
    name: { tr: 'Tasarım & UX', en: 'Design & UX' },
    icon: '🎨',
    color: '#E84393',
    subcategories: [
      {
        id: 'ux-fundamentals',
        name: { tr: 'UX Temelleri', en: 'UX Fundamentals' },
        icon: '🧩',
        color: '#E84393',
      },
      {
        id: 'ux-research',
        name: { tr: 'UX Araştırma', en: 'UX Research' },
        icon: '🔍',
        color: '#A29BFE',
      },
      {
        id: 'ui-design',
        name: { tr: 'UI Tasarım', en: 'UI Design' },
        icon: '🎯',
        color: '#00CEC9',
      },
      {
        id: 'figma',
        name: { tr: 'Figma', en: 'Figma' },
        icon: '✏️',
        color: '#6C5CE7',
      },
      {
        id: 'typography',
        name: { tr: 'Tipografi', en: 'Typography' },
        icon: '🔤',
        color: '#FDCB6E',
      },
      {
        id: 'design-systems',
        name: { tr: 'Tasarım Sistemleri', en: 'Design Systems' },
        icon: '📐',
        color: '#0984E3',
      },
      {
        id: 'project-management',
        name: { tr: 'Proje Yönetimi', en: 'Project Management' },
        icon: '📋',
        color: '#E17055',
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

export function getDescendantIds(category: Category): string[] {
  const ids: string[] = [];
  if (category.subcategories) {
    for (const sub of category.subcategories) {
      ids.push(sub.id);
      ids.push(...getDescendantIds(sub));
    }
  }
  return ids;
}

export function findCategoryById(id: string): Category | undefined {
  function find(cats: Category[]): Category | undefined {
    for (const cat of cats) {
      if (cat.id === id) return cat;
      if (cat.subcategories) {
        const found = find(cat.subcategories);
        if (found) return found;
      }
    }
  }
  return find(categories);
}

export function findParentCategory(childId: string): Category | undefined {
  function find(cats: Category[], parent?: Category): Category | undefined {
    for (const cat of cats) {
      if (cat.id === childId) return parent;
      if (cat.subcategories) {
        const found = find(cat.subcategories, cat);
        if (found) return found;
      }
    }
  }
  return find(categories);
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
