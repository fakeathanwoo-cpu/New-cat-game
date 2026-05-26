export interface Character {
  id: number;
  name: string;
  price: number;
  description: string;
  specialAbility?: string;
  color: string;
  glowColor: string;
  extraStats?: {
    maxHealth?: number;
    maxEnergy?: number;
    speedMult?: number;
  };
  traits?: string[];
  visuals?: {
    bodyType?: 'slim' | 'stocky' | 'fluffy' | 'standard' | 'panther';
    pattern?: 'stripes' | 'dots' | 'none';
    patternColor?: string;
    hasMask?: boolean;
    hasSocks?: boolean;
  };
}

export interface Upgrade {
  id: string;
  name: string;
  price: number;
  description: string;
  maxLevel: number;
}

export const CHARACTERS: Character[] = [
  {
    id: 1,
    name: "Classic Orange",
    price: 0,
    description: "A friendly tabby navigating the dreamscape.",
    specialAbility: "Balance: Reliable agility for all missions.",
    color: "#f97316",
    glowColor: "rgba(249, 115, 22, 0.5)",
    traits: ["Orange Stripes", "Curious Ears", "Standard Fluff"],
    visuals: {
      bodyType: 'standard',
      pattern: 'stripes',
      patternColor: '#c2410c',
      hasSocks: true
    }
  },
  {
    id: 2,
    name: "Midnight Void",
    price: 5000,
    description: "Sleek black cat that blends into the shadows.",
    specialAbility: "Obsidian Core: Innate +20 Health bonus.",
    color: "#18181b",
    glowColor: "rgba(31, 41, 55, 0.6)",
    extraStats: { maxHealth: 120 },
    traits: ["Obsidian Fur", "Lean Body", "Stealthy Paws"],
    visuals: {
      bodyType: 'slim',
      pattern: 'none',
      hasSocks: false
    }
  },
  {
    id: 3,
    name: "Golden Calico",
    price: 15000,
    description: "Tricolor charm with a larger energy core.",
    specialAbility: "Lucky Battery: Innate +20 Energy bonus.",
    color: "#fbbf24",
    glowColor: "rgba(251, 191, 36, 0.7)",
    extraStats: { maxEnergy: 120 },
    traits: ["Tri-color Fur", "Tufted Ears", "Lucky Vibe"],
    visuals: {
      bodyType: 'stocky',
      pattern: 'dots',
      patternColor: '#18181b',
      hasSocks: true
    }
  },
  {
    id: 4,
    name: "Siamese Spirit",
    price: 50000,
    description: "Lean and elegant. Moves with supernatural speed.",
    specialAbility: "ULTIMATE: Teleport Dash [Shift+Q].",
    color: "#e5e7eb",
    glowColor: "rgba(209, 213, 219, 0.7)",
    extraStats: { speedMult: 1.1 },
    traits: ["Dark Mask", "Slim Frame", "Blue Glow"],
    visuals: {
      bodyType: 'slim',
      pattern: 'none',
      hasMask: true,
      hasSocks: true
    }
  },
  {
    id: 5,
    name: "Royal Ragdoll",
    price: 150000,
    description: "Extremely fluffy. A true majesty of the dream realm.",
    specialAbility: "Cloud Float: Slow-fall & lift near clouds.",
    color: "#ffffff",
    glowColor: "rgba(255, 255, 255, 0.8)",
    extraStats: { maxHealth: 150, maxEnergy: 150 },
    traits: ["Triple Fluff", "Thick Mane", "Wispy Tail"],
    visuals: {
      bodyType: 'fluffy',
      pattern: 'none'
    }
  },
  {
    id: 6,
    name: "Bengal King",
    price: 500000,
    description: "Muscular and wild. The largest cat before royalty.",
    specialAbility: "ULTIMATE: Battle Roar [Shift+Q].",
    color: "#c2410c",
    glowColor: "rgba(194, 65, 12, 0.9)",
    extraStats: { maxHealth: 200, maxEnergy: 200, speedMult: 1.2 },
    traits: ["Wild Leopard Spots", "Sturdy Build", "Golden Aura"],
    visuals: {
      bodyType: 'stocky',
      pattern: 'dots',
      patternColor: '#431407'
    }
  },
  {
    id: 7,
    name: "Void God Panther",
    price: 2500000,
    description: "The apex predator. Unlocks the true potential of the void. Ultimate power.",
    specialAbility: "ULTIMATE: Void Singularity (Magnet + Spectral Slashes + Soul Siphon).",
    color: "#000000",
    glowColor: "rgba(255, 78, 0, 1)",
    extraStats: { maxHealth: 300, maxEnergy: 300, speedMult: 1.5 },
    traits: ["Singularity Heart", "Reality Glitch", "Void Gaze"],
    visuals: {
      bodyType: 'panther',
      pattern: 'none'
    }
  }
];

export const UPGRADES: Upgrade[] = [
  {
    id: 'health',
    name: 'Vitality',
    price: 2000,
    description: 'Increases base health capacity.',
    maxLevel: 15
  },
  {
    id: 'energy',
    name: 'Energy Core',
    price: 3000,
    description: 'Increases maximum battery capacity.',
    maxLevel: 15
  },
  {
    id: 'damage',
    name: 'Sharp Claws',
    price: 5000,
    description: 'Fires additional energy bolts (Max 7 bolts).',
    maxLevel: 6
  }
];
