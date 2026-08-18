import { randomInt } from "node:crypto";

// Temp passwords are relayed over WhatsApp voice/text — word-word-digits
// reads aloud unambiguously (kickoff §2).
const WORDS = [
  "brisk", "calm", "clever", "eager", "fancy", "gentle", "happy", "jolly",
  "kind", "lively", "merry", "noble", "proud", "quick", "sharp", "smart",
  "sunny", "swift", "tidy", "witty", "otter", "tiger", "eagle", "falcon",
  "lion", "panda", "robin", "shark", "whale", "zebra", "mango", "lotus",
];

export function generateTempPassword(): string {
  const word1 = WORDS[randomInt(WORDS.length)];
  const word2 = WORDS[randomInt(WORDS.length)];
  const digits = String(randomInt(1000, 10000));
  return `${word1}-${word2}-${digits}`;
}
