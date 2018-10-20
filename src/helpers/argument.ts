import { readFileSync } from 'fs';

export function getURLsFromArgOrSTDIN(argURL?: string): string[] {
  if (argURL) {
    return[argURL];
  }

  const input = readFileSync(0, 'utf-8').toString();
  const lines = input
      .split('\n')
      .map(l => l.trim())
      .filter(l => l !== '');
  return lines;
}

export function getArrayOption(optVal?: string | string[] | null): string[] {
  if (!optVal) {
    return [];
  }
  if (typeof optVal === 'string') {
    return [optVal];
  }
  return Array.from(optVal.map(String));
}
