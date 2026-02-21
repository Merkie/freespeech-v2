export type SkinTone = 'dark' | 'medium-dark' | 'medium' | 'medium-light' | 'light';

export const SkinTones: {
  name: SkinTone;
  pigmentHexValue: string;
}[] = [
  {
    name: 'dark',
    pigmentHexValue: '#774837',
  },
  {
    name: 'medium-dark',
    pigmentHexValue: '#af7450',
  },
  {
    name: 'medium',
    pigmentHexValue: '#d7a481',
  },
  {
    name: 'medium-light',
    pigmentHexValue: '#f6cc9d',
  },
  {
    name: 'light',
    pigmentHexValue: '#fadbca',
  },
];
