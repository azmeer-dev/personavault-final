'use server';

import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import prisma from '@/lib/prisma';

export async function deleteIdentity(formData: FormData): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/signin');

  const id = formData.get('id')?.toString();
  if (!id) return;

  await prisma.identity.delete({ where: { id } });
  revalidatePath('/identities');
}
