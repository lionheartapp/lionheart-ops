import { randomBytes } from 'node:crypto'

const bytes = randomBytes(48)
const secret = bytes.toString('base64url')

console.log('\nGenerated AUTH_SECRET:\n')
console.log(secret)
console.log('\nAdd this to your .env.local and Vercel Project Settings.\n')
