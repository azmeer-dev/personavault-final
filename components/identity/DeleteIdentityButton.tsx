'use client';

import { deleteIdentity } from '@/app/actions/deleteIdentity';
import { Button } from '@/components/ui/button';

export default function DeleteButton({ id }: { id: string }) {
  return (
    <form
      action={async (formData) => {
        const confirmDelete = confirm('Are you sure you want to delete this identity?');
        if (!confirmDelete) return;
        await deleteIdentity(formData);
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button className="w-full sm:w-auto mb-2 sm:mb-0"variant="destructive" size="sm" type="submit">
        Delete
      </Button>
    </form>
  );
}
