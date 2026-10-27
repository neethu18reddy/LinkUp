import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getAuthOptions } from './account.api';
export function GoogleSignIn() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let active = true;
    void getAuthOptions()
      .then((options) => {
        if (active) setEnabled(options.googleEnabled);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return enabled ? (
    <div className="google-sign-in">
      <p>or continue with</p>
      <Button asChild variant="outline">
        <a href="/api/v1/auth/google/start">Continue with Google</a>
      </Button>
    </div>
  ) : null;
}
