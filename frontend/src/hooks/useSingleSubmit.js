import { useRef, useState } from 'react';

export default function useSingleSubmit(asyncFn, { form = false } = {}) {
  const lockRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(...args) {
    if (form) args[0].preventDefault();
    if (lockRef.current) return;
    lockRef.current = true;
    setSubmitting(true);
    try {
      return await asyncFn(...args);
    } catch (error) {
      if (!error?.isDuplicateBlocked) throw error;
    } finally {
      lockRef.current = false;
      setSubmitting(false);
    }
  }

  return [submit, submitting];
}
