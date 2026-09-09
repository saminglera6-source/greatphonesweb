import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

const email = process.argv[2]
const password = process.argv[3]
const name = process.argv[4] || 'Admin'

if (!email || !password) {
  console.error('Uso: node scripts/create-admin.mjs <email> <password> [nombre]')
  process.exit(1)
}

const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) })
const hashed = await bcrypt.hash(password, 10)

const user = await prisma.user.upsert({
  where: { email },
  update: { password: hashed, role: 'ADMIN', name },
  create: { email, password: hashed, role: 'ADMIN', name },
})

console.log('OK ->', { id: user.id, email: user.email, role: user.role })
await prisma.$disconnect()
