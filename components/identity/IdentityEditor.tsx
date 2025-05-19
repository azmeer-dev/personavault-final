'use client';

import IdentityForm from '@/components/identity/IdentityForm';
import IdentityLiveCard from '@/components/identity/IdentityLiveCard';
import { useFormContext } from 'react-hook-form';
import type { IdentityFormValues } from '@/types/types';

/* derive props the form expects */
type IdentityFormProps = Parameters<typeof IdentityForm>[0];

export default function IdentityEditor(props: IdentityFormProps) {
  return (
    <IdentityForm
      {...props}
      /* pass the accounts list to the preview */
      rightPane={<LivePreview accounts={props.accounts} />}
    />
  );
}

/* -------------------------------------------------------- */
/* Preview must run inside <FormProvider>                   */
/* -------------------------------------------------------- */

interface LivePreviewProps {
  accounts: IdentityFormProps['accounts'];
}

function LivePreview({ accounts }: LivePreviewProps) {
  const { watch } = useFormContext<IdentityFormValues>();
  const data = watch();
  return <IdentityLiveCard data={data} accounts={accounts} />;
}
