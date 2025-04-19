export const Highlight = {
  novel: 'novel',
  novel_word: 'novel_word',
} as const;

export type HighlightType = (typeof Highlight)[keyof typeof Highlight];

export interface JsonOutput {
  readonly chunks: Chunk[][];
  readonly language: string;
  readonly path: string;
  readonly status: string;
}

export interface Chunk {
  readonly rhs: Rhs;
}

export interface Rhs {
  readonly line_number: number;
  readonly changes: Change[];
}

export interface Change {
  readonly start: number;
  readonly end: number;
  readonly content: string;
  readonly highlight_type: HighlightType;
}
