import { randomInt } from 'node:crypto';
import { CODE_ALPHABET, CODE_LENGTH } from '../../shared/limits';

export type RandomInt = (maxExclusive: number) => number;

/** Generate a room code that is not in `taken`. Throws if the space looks exhausted. */
export function generateCode(
  taken: (code: string) => boolean,
  rand: RandomInt = (n) => randomInt(n),
  maxAttempts = 1000,
): string {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[rand(CODE_ALPHABET.length)];
    if (!taken(code)) return code;
  }
  throw new Error('Could not allocate a room code');
}
