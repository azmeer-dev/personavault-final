import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import IdentityEditor from '@/components/identity/IdentityEditor';

export default async function NewIdentityPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/signin');

  const accounts = await prisma.account.findMany({
    where: { userId: session.user.id },
    select: { id: true, provider: true, emailFromProvider: true },
  });

  return (
    <main className="p-6 max-w-6xl mx-auto overflow-hidden">
      <h1 className="mb-6 text-xl font-semibold">New Identity</h1>
      <IdentityEditor userId={session.user.id} accounts={accounts} />
    </main>
  );
}
