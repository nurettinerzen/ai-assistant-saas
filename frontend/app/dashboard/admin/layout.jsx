'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldCheck, ShieldAlert, Mail } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function AdminLayout({ children }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [needsMfa, setNeedsMfa] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [challengeId, setChallengeId] = useState('');
  const [expiresAt, setExpiresAt] = useState(null);
  const [code, setCode] = useState('');

  useEffect(() => {
    checkAccess();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAccess = async () => {
    try {
      setLoading(true);
      const me = await apiClient.auth.me();
      if (!me.data?.isAdmin) {
        setAuthorized(false);
        setNeedsMfa(false);
        return;
      }

      const status = await apiClient.auth.adminMfaStatus();
      if (status.data?.mfaVerified) {
        setAuthorized(true);
        setNeedsMfa(false);
      } else {
        setAuthorized(false);
        setNeedsMfa(true);
      }
    } catch (error) {
      if (error.response?.status === 401) {
        router.push('/login');
        return;
      }
      setAuthorized(false);
      setNeedsMfa(false);
    } finally {
      setLoading(false);
    }
  };

  const requestChallenge = async () => {
    try {
      setSendingCode(true);
      const response = await apiClient.auth.adminMfaChallenge();
      setChallengeId(response.data?.challengeId || '');
      setExpiresAt(response.data?.expiresAt || null);
      toast.success('MFA code sent to your admin email.');
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to send MFA code.';
      toast.error(message);
    } finally {
      setSendingCode(false);
    }
  };

  const verifyCode = async (event) => {
    event.preventDefault();
    if (!challengeId || !code) {
      toast.error('Challenge ID and verification code are required.');
      return;
    }

    try {
      setVerifying(true);
      await apiClient.auth.adminMfaVerify(challengeId, code.trim());
      toast.success('Admin MFA verified.');
      setCode('');
      await checkAccess();
    } catch (error) {
      const message = error.response?.data?.error || 'Invalid MFA code.';
      toast.error(message);
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!authorized && !needsMfa) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-lg border border-neutral-200 bg-white p-8 text-center dark:border-neutral-700 dark:bg-neutral-900">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-red-500" />
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Access Denied</h2>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Admin privileges are required for this area.
        </p>
      </div>
    );
  }

  if (!authorized && needsMfa) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-900">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Admin MFA Required</h2>
        </div>
        <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
          Verify with your email one-time code to continue.
        </p>

        <Button
          type="button"
          onClick={requestChallenge}
          disabled={sendingCode}
          className="mb-4 w-full"
        >
          {sendingCode ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending code...
            </>
          ) : (
            <>
              <Mail className="mr-2 h-4 w-4" />
              Send verification code
            </>
          )}
        </Button>

        <form onSubmit={verifyCode} className="space-y-3">
          <div>
            <Label htmlFor="challenge-id">Challenge ID</Label>
            <Input
              id="challenge-id"
              value={challengeId}
              onChange={(e) => setChallengeId(e.target.value)}
              placeholder="Paste challenge id"
              required
            />
          </div>
          <div>
            <Label htmlFor="mfa-code">6-digit code</Label>
            <Input
              id="mfa-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              required
            />
          </div>
          {expiresAt && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Expires at {new Date(expiresAt).toLocaleString()}.
            </p>
          )}
          <Button type="submit" disabled={verifying} className="w-full">
            {verifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify and continue'
            )}
          </Button>
        </form>
      </div>
    );
  }

  return children;
}
