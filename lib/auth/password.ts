import { randomInt } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";

// Algorithm.Argon2id. Inlined: `isolatedModules` cannot read a value off
// the package's ambient const enum.
const ARGON2ID = 2;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, { algorithm: ARGON2ID });
}

export async function verifyPassword(hashValue: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashValue, plain);
  } catch {
    return false;
  }
}

let dummy: Promise<string> | undefined;

/**
 * A real hash of a value nobody knows, made once per process. Verifying
 * against it when the account does not exist makes "no such user" cost the
 * same time as "wrong password", so response time does not reveal which
 * emails have accounts.
 */
export function dummyHash(): Promise<string> {
  dummy ??= hashPassword(crypto.randomUUID());
  return dummy;
}

// No 0/O, 1/l/I: the owner reads this aloud or writes it on paper.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateTemporaryPassword(length = 14): string {
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}
