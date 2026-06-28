import { prisma } from '../client.js';

export async function createUser(email: string, passwordHash: string) {
  return prisma.user.create({
    data: { email, passwordHash },
    select: { id: true, email: true, createdAt: true },
  });
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
  });
}

export async function findUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, createdAt: true },
  });
}
